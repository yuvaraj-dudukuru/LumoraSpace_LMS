import "server-only";
import { Prisma, type CertificateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const certificateSelect = {
  id: true,
  certificateNumber: true,
  templateName: true,
  status: true,
  issuedAt: true,
  program: { select: { id: true, name: true } },
} satisfies Prisma.CertificateSelect;

export type LearnerCertificate = Prisma.CertificateGetPayload<{ select: typeof certificateSelect }>;

export async function getCertificatesForUser(userId: string): Promise<LearnerCertificate[]> {
  return prisma.certificate.findMany({
    where: { userId },
    select: certificateSelect,
    orderBy: { issuedAt: "desc" },
  });
}

const certificateDetailSelect = {
  id: true,
  certificateNumber: true,
  templateName: true,
  status: true,
  issuedAt: true,
  revokedAt: true,
  revokedReason: true,
  userId: true, // for the caller's page to verify ownership — never rendered
  program: { select: { id: true, name: true } },
} satisfies Prisma.CertificateSelect;

export type CertificateDetailForUser = Prisma.CertificateGetPayload<{ select: typeof certificateDetailSelect }>;

/** Includes userId purely for the [id] page's ownership check — that page
 * must confirm cert.userId === the caller's own id before rendering, and
 * never expose another learner's certificate. */
export async function getCertificateDetailForUser(certificateId: string): Promise<CertificateDetailForUser | null> {
  return prisma.certificate.findUnique({
    where: { id: certificateId },
    select: certificateDetailSelect,
  });
}

export type VerifiedCertificate = {
  learnerName: string;
  programName: string;
  issuedAt: Date;
  status: CertificateStatus;
};

/** PUBLIC lookup for /verify/[certificateNumber] — deliberately selects
 * nothing beyond what that page is allowed to show. Never add userId, email,
 * batchId, or enrollmentId to this select or its return shape. */
export async function getCertificateForVerification(certificateNumber: string): Promise<VerifiedCertificate | null> {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber },
    select: {
      issuedAt: true,
      status: true,
      user: { select: { name: true } },
      program: { select: { name: true } },
    },
  });
  if (!certificate) return null;

  return {
    learnerName: certificate.user.name,
    programName: certificate.program.name,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
  };
}
