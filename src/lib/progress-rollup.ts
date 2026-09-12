import "server-only";
import { prisma } from "@/lib/prisma";
import { getProgramProgress, type ProgramProgress } from "@/lib/queries/progress";

/** THE one place that recomputes and caches Enrollment.progressPercent after
 * a completion event. Both markLessonComplete
 * (src/app/learn/lessons/[lessonId]/actions.ts) and submitAttempt's quiz-
 * lesson completion (src/app/learn/attempts/[attemptId]/actions.ts) call this
 * instead of each inlining their own copy of the rollup. */
export async function refreshEnrollmentProgress(enrollmentId: string): Promise<ProgramProgress> {
  const progress = await getProgramProgress(enrollmentId);
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { progressPercent: progress.overallPercent },
  });
  return progress;
}
