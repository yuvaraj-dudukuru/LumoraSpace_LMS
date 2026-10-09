"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications";
import { announcementSchema, firstIssue, formObject } from "@/lib/validations/admin-content";

/** Writes one ANNOUNCEMENT notification per recipient (in-app only — no
 * email). Recipients are ACTIVE learners: everyone, or those with a live
 * (not cancelled/dropped) enrollment in the chosen program or batch. A
 * learner who switched off "system notifications" is skipped by notify(). */
export async function sendAnnouncement(formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = announcementSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { audience, programId, batchId, title, body } = parsed.data;

  const liveEnrollment: Prisma.EnrollmentWhereInput = { status: { notIn: ["CANCELLED", "DROPPED"] } };
  const where: Prisma.UserWhereInput = { role: "LEARNER", status: "ACTIVE" };
  if (audience === "program") where.enrollments = { some: { ...liveEnrollment, programId } };
  if (audience === "batch") where.enrollments = { some: { ...liveEnrollment, batchId } };

  const recipients = await prisma.user.findMany({ where, select: { id: true } });
  if (recipients.length === 0) return { ok: false, error: "No learners match that audience." };

  const written = await notify(
    recipients.map((recipient) => recipient.id),
    { type: NOTIFICATION_TYPE.ANNOUNCEMENT, title, body },
  );
  if (written === 0) {
    return { ok: false, error: "Nothing was sent — every matching learner has system notifications switched off." };
  }

  revalidatePath("/learn", "layout");
  return { ok: true, redirectTo: `/admin/notifications?sent=${written}` };
}
