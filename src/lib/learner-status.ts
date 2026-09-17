import type { EnrollmentStatus } from "@prisma/client";

/** Learner pace status — ONE pure function, no DB, no Date.now(), used by
 * /learn, /learn/progress and the mentor roster so the vocabulary and the
 * threshold live in exactly one place. Callers pass `now`.
 *
 * It classifies pace only: how far a learner is through the program versus
 * how far through the batch's calendar they are. It is unrelated to the
 * mentor "needs attention" rule (queries/mentor.ts), which measures activity
 * recency, failed attempts and outstanding revisions. */
export type LearnerStatus = "NOT_STARTED" | "ON_TRACK" | "BEHIND" | "COMPLETED";

/** A learner counts as on track while their progress is within this many
 * percentage points below the batch's elapsed percentage. */
export const ON_TRACK_TOLERANCE_PERCENT = 10;

export type LearnerStatusInput = {
  batchStart: Date;
  batchEnd: Date;
  now: Date;
  /** getProgramProgress().overallPercent on learner pages; the cached
   * Enrollment.progressPercent on the mentor roster. */
  progressPercent: number;
  enrollmentStatus: EnrollmentStatus;
};

/** How far through the batch's calendar `now` is, clamped to 0..100. A batch
 * whose end isn't after its start is treated as fully elapsed. */
export function elapsedPercent(batchStart: Date, batchEnd: Date, now: Date): number {
  const total = batchEnd.getTime() - batchStart.getTime();
  if (total <= 0) return 100;
  const elapsed = now.getTime() - batchStart.getTime();
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/** Rules, in order:
 *   1. enrollment COMPLETED, or progress at 100        → COMPLETED
 *   2. now before the batch starts                    → NOT_STARTED
 *   3. progress >= elapsed% − ON_TRACK_TOLERANCE      → ON_TRACK
 *   4. otherwise                                      → BEHIND
 * After the batch ends, elapsed is 100, so anything under 90 reads BEHIND.
 * Any enrollment status other than COMPLETED just follows the pace rule —
 * whether a DROPPED/PENDING row is shown at all is the caller's decision. */
export function deriveLearnerStatus(input: LearnerStatusInput): LearnerStatus {
  if (input.enrollmentStatus === "COMPLETED" || input.progressPercent >= 100) return "COMPLETED";
  if (input.now.getTime() < input.batchStart.getTime()) return "NOT_STARTED";
  const elapsed = elapsedPercent(input.batchStart, input.batchEnd, input.now);
  return input.progressPercent >= elapsed - ON_TRACK_TOLERANCE_PERCENT ? "ON_TRACK" : "BEHIND";
}
