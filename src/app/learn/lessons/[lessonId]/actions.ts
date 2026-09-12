"use server";

import { revalidatePath } from "next/cache";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveLessonProgram } from "@/lib/queries/lessons";
import { getProgramProgress } from "@/lib/queries/progress";
import { lessonNotesSchema } from "@/lib/validations/lesson";
import { prisma } from "@/lib/prisma";

export type MarkCompleteResult = { ok: true; overallPercent: number } | { ok: false; error: string };

/** lessonId is attacker-controlled — re-resolves its program and re-verifies
 * a granted enrollment server-side on every call, never trusts the caller. */
export async function markLessonComplete(lessonId: string): Promise<MarkCompleteResult> {
  const resolved = await resolveLessonProgram(lessonId);
  if (!resolved) return { ok: false, error: "Lesson not found." };

  const enrollment = await requireGrantedEnrollment(resolved.programId);

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: { enrollmentId: enrollment.id, lessonId, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  });

  const progress = await getProgramProgress(enrollment.id);
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { progressPercent: progress.overallPercent },
  });

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
