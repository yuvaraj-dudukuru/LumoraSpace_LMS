"use server";

import { revalidatePath } from "next/cache";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveLessonProgram } from "@/lib/queries/lessons";
import { refreshEnrollmentProgress } from "@/lib/progress-rollup";
import { nextStreakState } from "@/lib/streak";
import { lessonNotesSchema } from "@/lib/validations/lesson";
import { prisma } from "@/lib/prisma";

export type MarkCompleteResult = { ok: true; overallPercent: number } | { ok: false; error: string };

/** lessonId is attacker-controlled — re-resolves its program and re-verifies
 * a granted enrollment server-side on every call, never trusts the caller. */
export async function markLessonComplete(lessonId: string): Promise<MarkCompleteResult> {
  const resolved = await resolveLessonProgram(lessonId);
  if (!resolved) return { ok: false, error: "Lesson not found." };

  const enrollment = await requireGrantedEnrollment(resolved.programId);

  const now = new Date();

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: { enrollmentId: enrollment.id, lessonId, completed: true, completedAt: now },
    update: { completed: true, completedAt: now },
  });

  // Streak: the ONE place User.streakDays / lastActiveAt are written. Same
  // calendar day (Asia/Kolkata) = unchanged, next day = +1, longer gap = 1.
  // Read-then-write on the user's own row; enrollment.userId came from the
  // guard, never from the client.
  const streakBefore = await prisma.user.findUniqueOrThrow({
    where: { id: enrollment.userId },
    select: { streakDays: true, lastActiveAt: true },
  });
  await prisma.user.update({
    where: { id: enrollment.userId },
    data: nextStreakState(streakBefore, now),
  });

  const progress = await refreshEnrollmentProgress(enrollment.id);

  revalidatePath(`/learn/lessons/${lessonId}`);
  revalidatePath(`/learn/programs/${resolved.programId}`);
  revalidatePath("/learn");
  revalidatePath("/learn/my-learning");
  revalidatePath("/learn/progress");

  return { ok: true, overallPercent: progress.overallPercent };
}

export type SaveNotesResult = { ok: true } | { ok: false; error: string };

export async function saveLessonNotes(lessonId: string, notes: string): Promise<SaveNotesResult> {
  const parsed = lessonNotesSchema.safeParse({ notes });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid notes" };
  }

  const resolved = await resolveLessonProgram(lessonId);
  if (!resolved) return { ok: false, error: "Lesson not found." };

  const enrollment = await requireGrantedEnrollment(resolved.programId);

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: { enrollmentId: enrollment.id, lessonId, notes: parsed.data.notes },
    update: { notes: parsed.data.notes },
  });

  return { ok: true };
}
