"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { updateEnrollmentStatusSchema } from "@/lib/validations/admin";
import { sendAccessGrantedEmail } from "@/lib/mail";

function revalidateEnrollments(): void {
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin");
}

export type EnrollmentActionResult = { ok: true } | { ok: false; error: string };

/** AWAITING -> GRANTED, and PENDING -> ACTIVE. The action that actually lets
 * a learner into content. Re-fetches the enrollment server-side rather than
 * trusting the page already showed it as AWAITING. */
export async function grantAccess(enrollmentId: string): Promise<EnrollmentActionResult> {
  await requireRole("ADMIN");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      accessState: true,
      user: { select: { name: true, email: true } },
      program: { select: { name: true } },
    },
  });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };
  if (enrollment.accessState !== "AWAITING") {
    return { ok: false, error: "Only an AWAITING enrollment can be granted access." };
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { accessState: "GRANTED", status: "ACTIVE" },
  });

  revalidateEnrollments();

  // Fire-and-forget-safe: sendAccessGrantedEmail never throws (see mail.ts),
  // so an email/Resend failure here can't roll back the grant that already
  // committed above or fail this action.
  await sendAccessGrantedEmail(enrollment.user.email, {
    learnerName: enrollment.user.name,
    programName: enrollment.program.name,
    loginUrl: "/login",
  });

  return { ok: true };
}

/** GRANTED -> SUSPENDED. The learner keeps the enrollment row (and whatever
 * EnrollmentStatus it has) but requireGrantedEnrollment starts 403ing them —
 * see auth-guards.ts's isEnrollmentGranted, unchanged by this milestone. */
export async function suspendAccess(enrollmentId: string): Promise<EnrollmentActionResult> {
  await requireRole("ADMIN");

  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };
  if (enrollment.accessState === "SUSPENDED") return { ok: true }; // idempotent
  if (enrollment.accessState !== "GRANTED") {
    return { ok: false, error: "Only a GRANTED enrollment can be suspended." };
  }

  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { accessState: "SUSPENDED" } });

  revalidateEnrollments();
  return { ok: true };
}

/** CANCELLED / DROPPED only — see validations/admin.ts for why the other
 * three EnrollmentStatus values aren't reachable through this action. */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  input: { status: string },
): Promise<EnrollmentActionResult> {
  await requireRole("ADMIN");

  const parsed = updateEnrollmentStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status." };

  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };

  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: parsed.data.status } });

  revalidateEnrollments();
  return { ok: true };
}

export type BulkGrantResult = { ok: true; grantedCount: number } | { ok: false; error: string };

/** One updateMany, not a per-row loop. Filtering accessState: "AWAITING"
 * inside the query itself means a stale selection (a row someone else
 * already granted between page load and click) is silently skipped rather
 * than erroring. */
export async function bulkGrantAccess(enrollmentIds: string[]): Promise<BulkGrantResult> {
  await requireRole("ADMIN");

  if (enrollmentIds.length === 0) return { ok: false, error: "No enrollments selected." };

  const result = await prisma.enrollment.updateMany({
    where: { id: { in: enrollmentIds }, accessState: "AWAITING" },
    data: { accessState: "GRANTED", status: "ACTIVE" },
  });

  revalidateEnrollments();
  return { ok: true, grantedCount: result.count };
}
