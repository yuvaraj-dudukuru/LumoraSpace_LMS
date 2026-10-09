"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { updateEnrollmentStatusSchema } from "@/lib/validations/admin";
import { sendAccessGrantedEmail } from "@/lib/mail";
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications";
import { createEnrollmentSchema, firstIssue, formObject } from "@/lib/validations/admin-content";
import type { ActionResult } from "@/lib/action-result";

function revalidateEnrollments(): void {
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/batches", "layout");
  revalidatePath("/admin");
  revalidatePath("/learn", "layout");
}

/** In-app counterpart of sendAccessGrantedEmail — never throws (notifications.ts). */
async function notifyAccessGranted(userIds: string[], programName: string): Promise<void> {
  await notify(userIds, {
    type: NOTIFICATION_TYPE.ACCESS_GRANTED,
    title: `You now have access to ${programName}`,
    body: "Your enrollment was approved. Open My Learning to start the first lesson.",
    actionUrl: "/learn/my-learning",
  });
}

/** "Create Enrollment" on /admin/enrollments — an admin placing a learner
 * into a batch directly. Same gates as the learner's own enrollAction
 * (open batch, capacity, no duplicate), plus one the learner flow never
 * needed: one live enrollment per program, which the learner-side queries
 * assume (queries/practice.ts). With "grant access" it lands GRANTED/ACTIVE
 * and the learner is told; otherwise PENDING/AWAITING like a self-enrollment. */
export async function createEnrollment(formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = createEnrollmentSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { userId, batchId, grantAccess: grant } = parsed.data;

  const [learner, batch] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true, status: true } }),
    prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
        capacity: true,
        programId: true,
        program: { select: { name: true, status: true } },
      },
    }),
  ]);
  if (!learner || learner.role !== "LEARNER") return { ok: false, error: "Only learner accounts can be enrolled." };
  if (learner.status !== "ACTIVE") return { ok: false, error: "This learner's account is inactive." };
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.status !== "UPCOMING" && batch.status !== "ACTIVE") {
    return { ok: false, error: "Only an upcoming or active batch can take new enrollments." };
  }
  if (batch.program.status === "ARCHIVED") return { ok: false, error: "This program is archived." };

  const [seatsTaken, sameProgram] = await Promise.all([
    prisma.enrollment.count({ where: { batchId, status: { notIn: ["CANCELLED", "DROPPED"] } } }),
    prisma.enrollment.findFirst({
      where: { userId, programId: batch.programId, status: { notIn: ["CANCELLED", "DROPPED"] } },
      select: { id: true },
    }),
  ]);
  if (sameProgram) return { ok: false, error: `${learner.name} is already enrolled in ${batch.program.name}.` };
  if (batch.capacity !== null && seatsTaken >= batch.capacity) return { ok: false, error: "This batch is full." };

  try {
    await prisma.enrollment.create({
      data: {
        userId,
        programId: batch.programId,
        batchId,
        status: grant ? "ACTIVE" : "PENDING",
        accessState: grant ? "GRANTED" : "AWAITING",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: `${learner.name} already has an enrollment in this batch.` };
    }
    throw error;
  }

  revalidateEnrollments();
  if (grant) {
    await notifyAccessGranted([userId], batch.program.name);
    await sendAccessGrantedEmail(learner.email, { learnerName: learner.name, programName: batch.program.name });
  }
  return { ok: true };
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
      user: { select: { id: true, name: true, email: true } },
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
  await notifyAccessGranted([enrollment.user.id], enrollment.program.name);

  // Fire-and-forget-safe: sendAccessGrantedEmail never throws (see mail.ts),
  // so an email/Resend failure here can't roll back the grant that already
  // committed above or fail this action. The login link is built inside
  // mail.ts from APP_URL — absolute, or the send is skipped with a log.
  await sendAccessGrantedEmail(enrollment.user.email, {
    learnerName: enrollment.user.name,
    programName: enrollment.program.name,
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

/** SUSPENDED -> GRANTED: undoes suspendAccess. Not the first grant, so no
 * email/notification and EnrollmentStatus is left exactly as it was. */
export async function restoreAccess(enrollmentId: string): Promise<EnrollmentActionResult> {
  await requireRole("ADMIN");

  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { accessState: true } });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };
  if (enrollment.accessState === "GRANTED") return { ok: true }; // idempotent
  if (enrollment.accessState !== "SUSPENDED") {
    return { ok: false, error: "Only a SUSPENDED enrollment can be restored." };
  }

  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { accessState: "GRANTED" } });

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

/** Read the AWAITING rows first (so we know WHO to email), then one
 * updateMany over exactly those ids — still filtered on accessState:
 * "AWAITING" inside the query, so a stale selection (a row someone else
 * granted between page load and click) is silently skipped rather than
 * erroring — then one access-granted email per granted row. Emails go out
 * AFTER the grant has committed, via Promise.allSettled: sendAccessGrantedEmail
 * never throws (see mail.ts), and allSettled means even an unexpected
 * rejection in one send can't stop the others or fail this action. */
export async function bulkGrantAccess(enrollmentIds: string[]): Promise<BulkGrantResult> {
  await requireRole("ADMIN");

  if (enrollmentIds.length === 0) return { ok: false, error: "No enrollments selected." };

  const awaiting = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds }, accessState: "AWAITING" },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
      program: { select: { name: true } },
    },
  });
  if (awaiting.length === 0) {
    revalidateEnrollments();
    return { ok: true, grantedCount: 0 };
  }

  const result = await prisma.enrollment.updateMany({
    where: { id: { in: awaiting.map((row) => row.id) }, accessState: "AWAITING" },
    data: { accessState: "GRANTED", status: "ACTIVE" },
  });

  revalidateEnrollments();

  // One in-app notification per learner, grouped by program so each names the right one.
  const userIdsByProgram = new Map<string, string[]>();
  for (const row of awaiting) {
    userIdsByProgram.set(row.program.name, [...(userIdsByProgram.get(row.program.name) ?? []), row.user.id]);
  }
  for (const [programName, userIds] of userIdsByProgram) await notifyAccessGranted(userIds, programName);

  const sends = await Promise.allSettled(
    awaiting.map((row) =>
      sendAccessGrantedEmail(row.user.email, {
        learnerName: row.user.name,
        programName: row.program.name,
      }),
    ),
  );
  for (const [index, outcome] of sends.entries()) {
    if (outcome.status === "rejected") {
      console.error("bulkGrantAccess: access-granted email rejected", { enrollmentId: awaiting[index]?.id, reason: outcome.reason });
    }
  }

  return { ok: true, grantedCount: result.count };
}
