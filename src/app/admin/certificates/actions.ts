"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { issueCertificateIfEligible } from "@/lib/certificates";

/** The one DELIBERATE issuance path besides the automatic one in
 * refreshEnrollmentProgress: an admin issuing for an enrollment listed as
 * "Eligible" on /admin/certificates (100% with no certificate — which only
 * happens when a curriculum edit, not a completion, got it to 100%).
 *
 * It goes through the same issueCertificateIfEligible, so the same rules
 * hold and are re-checked here: exactly 100%, and no certificate of ANY
 * status — a revoked certificate is never re-issued this way. */
export async function issueCertificate(enrollmentId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { progressPercent: true, status: true, _count: { select: { certificates: true } } },
  });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };
  if (enrollment.status === "CANCELLED" || enrollment.status === "DROPPED") {
    return { ok: false, error: "This enrollment was cancelled." };
  }
  if (enrollment._count.certificates > 0) return { ok: false, error: "This enrollment already has a certificate." };
  if (enrollment.progressPercent !== 100) return { ok: false, error: "The learner hasn't completed the program." };

  const certificate = await issueCertificateIfEligible(enrollmentId);
  if (!certificate) return { ok: false, error: "This enrollment is no longer eligible." };

  revalidatePath("/admin/certificates");
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin");
  revalidatePath("/learn", "layout");
  return { ok: true, redirectTo: `/admin/certificates/${certificate.id}` };
}
