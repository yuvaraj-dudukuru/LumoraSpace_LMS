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

/** After an ADMIN changes what a program contains (a module published or
 * unpublished, a lesson added or removed), every live enrollment's cached
 * percentage is stale. This recomputes and stores it — and deliberately does
 * NOT issue certificates: a curriculum edit must never mint (or appear to
 * revoke) a credential as a side effect. An enrollment an edit leaves at
 * exactly 100% with no certificate shows up on /admin/certificates
 * ("Eligible"), where an admin issues it on purpose. Returns how many
 * enrollments changed. */
export async function recalculateProgramProgress(programId: string): Promise<number> {
  const enrollments = await prisma.enrollment.findMany({
    where: { programId, status: { notIn: ["CANCELLED", "DROPPED"] } },
    select: { id: true, progressPercent: true },
  });
  let changed = 0;
  for (const enrollment of enrollments) {
    const progress = await getProgramProgress(enrollment.id);
    if (progress.overallPercent === enrollment.progressPercent) continue;
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { progressPercent: progress.overallPercent },
    });
    changed += 1;
  }
  return changed;
}
