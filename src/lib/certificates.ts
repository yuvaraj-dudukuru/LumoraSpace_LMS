import "server-only";
import type { Certificate } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SEQUENCE_DIGITS = 5;

function certificateNumberPrefix(year: number): string {
  return `LUM-${year}-`;
}

function formatCertificateNumber(year: number, sequence: number): string {
  return `${certificateNumberPrefix(year)}${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
}

/** Finds the current max sequence number for `year` and returns the next
 * one. Not transactionally safe on its own — issueCertificateIfEligible
 * retries once on a P2002 conflict, which is the real race guard (two
 * learners finishing in the same second landing on the same number). */
async function nextCertificateNumber(year: number): Promise<string> {
  const prefix = certificateNumberPrefix(year);
  const latest = await prisma.certificate.findFirst({
    where: { certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });

  const lastSequence = latest ? Number.parseInt(latest.certificateNumber.slice(prefix.length), 10) : 0;
  return formatCertificateNumber(year, lastSequence + 1);
}

/** Idempotent: issues a certificate once an enrollment's progressPercent
 * is 100 and NO certificate of ANY status already exists for that
 * enrollment. A REVOKED certificate therefore blocks auto re-issuance —
 * revocation is an admin decision and must stick; the learner's next
 * completion event must not silently undo it. (Re-issuing after a
 * revocation, if ever wanted, is a deliberate admin action, not something
 * this function does.) Called from refreshEnrollmentProgress
 * (src/lib/progress-rollup.ts) — the ONE rollup call site, and only on the
 * <100 → 100 transition; do not add a second one. */
export async function issueCertificateIfEligible(enrollmentId: string): Promise<Certificate | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, userId: true, programId: true, batchId: true, progressPercent: true, status: true },
  });
  if (!enrollment || enrollment.progressPercent !== 100) return null;

  // Any status — VALID *or* REVOKED. Scoped to the enrollment (every
  // certificate this app or the seed creates carries enrollmentId).
  const existingAnyStatus = await prisma.certificate.findFirst({
    where: { enrollmentId: enrollment.id },
    select: { id: true },
  });
  if (existingAnyStatus) return null;

  if (enrollment.status !== "COMPLETED") {
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 2; attempt++) {
    const certificateNumber = await nextCertificateNumber(year);
    try {
      return await prisma.certificate.create({
        data: {
          certificateNumber,
          userId: enrollment.userId,
          programId: enrollment.programId,
          batchId: enrollment.batchId,
          enrollmentId: enrollment.id,
        },
      });
    } catch (error) {
      const isSequenceCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isSequenceCollision || attempt === 1) throw error;
      // Two learners finished in the same second and computed the same next
      // sequence number — loop once more to recompute the (now-advanced) max.
    }
  }

  throw new Error("Unreachable: certificate creation loop exited without returning or throwing.");
}
