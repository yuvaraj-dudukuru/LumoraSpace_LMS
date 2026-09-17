import "server-only";
import { prisma } from "@/lib/prisma";
import { getProgramProgress, type ProgramProgress } from "@/lib/queries/progress";
import { issueCertificateIfEligible } from "@/lib/certificates";

/** THE one place that recomputes and caches Enrollment.progressPercent after
 * a completion event. Both markLessonComplete
 * (src/app/learn/lessons/[lessonId]/actions.ts) and submitAttempt's quiz-
 * lesson completion (src/app/learn/attempts/[attemptId]/actions.ts) call this
 * instead of each inlining their own copy of the rollup. Also the ONE call
 * site for certificate issuance (M5c) — and only on the <100 → 100
 * TRANSITION made by this call (previous cached percent below 100, fresh
 * rollup exactly 100). A learner already at 100 re-completing a lesson
 * never re-enters issuance; do not add a second rollup/issuance path. */
export async function refreshEnrollmentProgress(enrollmentId: string): Promise<ProgramProgress> {
  const previous = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { progressPercent: true },
  });
  const progress = await getProgramProgress(enrollmentId);
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { progressPercent: progress.overallPercent },
  });
  const crossedToComplete = previous !== null && previous.progressPercent < 100 && progress.overallPercent === 100;
  if (crossedToComplete) {
    await issueCertificateIfEligible(enrollmentId);
  }
  return progress;
}
