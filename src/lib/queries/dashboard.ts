import "server-only";
import { AccessState, EnrollmentStatus, type ReviewOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProgramProgress, findNextIncompleteLesson, type ProgramProgress } from "@/lib/queries/progress";
import { deriveLearnerStatus, type LearnerStatus } from "@/lib/learner-status";
import { getPendingWork, type PendingWorkItem } from "@/lib/queries/pending-work";
import { pickNextStep, type NextStep } from "@/lib/next-step";
import { deriveAchievements, type Achievement } from "@/lib/achievements";

/** Phase A — every kind is derived from a row that already exists; nothing
 * is logged separately. `module_completed` is derived from the progress
 * tree (a module at 100%, timed by the latest completedAt of its lessons). */
export type ActivityItem =
  | { kind: "lesson_completed"; label: string; occurredAt: Date }
  | { kind: "assignment_submitted"; label: string; occurredAt: Date }
  | { kind: "assessment_submitted"; label: string; occurredAt: Date; scorePercent: number | null; passed: boolean | null }
  | { kind: "submission_reviewed"; label: string; occurredAt: Date; outcome: ReviewOutcome }
  | { kind: "module_completed"; label: string; occurredAt: Date }
  | { kind: "certificate_issued"; label: string; occurredAt: Date; certificateNumber: string };

export const RECENT_ACTIVITY_LIMIT = 10;

/** Tie-break for identical timestamps: larger events first. */
const ACTIVITY_KIND_RANK: Record<ActivityItem["kind"], number> = {
  certificate_issued: 0,
  module_completed: 1,
  submission_reviewed: 2,
  assessment_submitted: 3,
  assignment_submitted: 4,
  lesson_completed: 5,
};

export type DashboardData = {
  learnerName: string;
  streakDays: number;
  enrollment: { id: string; programId: string; programName: string };
  progress: ProgramProgress;
  /** Pace vs the batch calendar (src/lib/learner-status.ts); null only for a
   * batch-less enrollment, which the schema allows and the MVP never creates. */
  learnerStatus: LearnerStatus | null;
  /** Every assignment / unpassed GRADED assessment in this program, unsorted
   * (queries/pending-work.ts); the page sorts and slices. */
  pendingWork: PendingWorkItem[];
  nextLesson: { moduleId: string; lessonId: string; lessonTitle: string } | null;
  /** Priority pick (src/lib/next-step.ts): revision requested > overdue >
   * due within 3 days > next incomplete lesson; null when nothing is left. */
  nextStep: NextStep;
  /** Derived only, four kinds max, zero-count kinds omitted (src/lib/achievements.ts). */
  achievements: Achievement[];
  recentActivity: ActivityItem[];
} | null; // null => learner has no GRANTED/ACTIVE enrollment (empty state)

/** Everything /learn needs, in one shot per sub-query — no page-level looping. */
/** What the page already holds from requireUser() — passed in so this
 * function never re-reads the user row it was handed. */
export type DashboardViewer = { id: string; name: string; streakDays: number };

export async function getDashboardData(user: DashboardViewer): Promise<DashboardData> {
  const userId = user.id;

  // GRANTED enrollments that are ACTIVE or COMPLETED, most recent first; an
  // ACTIVE one is preferred so a learner who finished one program and joined
  // another lands on the live one. A COMPLETED-only learner still gets a
  // dashboard (Phase A — that's where their certificate and module
  // completions show), not the "not enrolled" empty state.
  const candidates = await prisma.enrollment.findMany({
    where: {
      userId,
      status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      accessState: AccessState.GRANTED,
    },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      programId: true,
      status: true,
      program: { select: { name: true } },
      batch: { select: { startDate: true, endDate: true } },
      // Folded into this select rather than a separate query — a learner has
      // at most one certificate per enrollment.
      certificates: {
        where: { status: "VALID" },
        select: { certificateNumber: true, issuedAt: true },
      },
    },
  });
  const enrollment = candidates.find((candidate) => candidate.status === EnrollmentStatus.ACTIVE) ?? candidates[0] ?? null;

  if (!enrollment) return null;

  const now = new Date();
  const progress = await getProgramProgress(enrollment.id);
  const next = findNextIncompleteLesson(progress);

  // One parallel wave. Each activity source is capped at RECENT_ACTIVITY_LIMIT
  // rows so the merge below can never need more than it shows.
  const [pendingWork, completedLessons, submissions, gradedAttempts, passedGradedAssessments, validCertificateCount] = await Promise.all([
    getPendingWork(enrollment.id, now),
    prisma.lessonProgress.findMany({
      where: { enrollmentId: enrollment.id, completed: true, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
      select: { completedAt: true, lesson: { select: { title: true } } },
    }),
    // submittedAt → "assignment_submitted"; review.reviewedAt → "submission_reviewed"
    prisma.submission.findMany({
      where: { enrollmentId: enrollment.id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        submittedAt: true,
        assignment: { select: { title: true } },
        review: { select: { outcome: true, reviewedAt: true } },
      },
    }),
    prisma.attempt.findMany({
      where: { enrollmentId: enrollment.id, status: "GRADED", submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
      select: { submittedAt: true, scorePercent: true, passed: true, assessment: { select: { title: true } } },
    }),
    // Achievements (Phase A): distinct GRADED assessments this enrollment has
    // passed — a count can't express DISTINCT, so this is a tiny id list.
    prisma.attempt.findMany({
      where: { enrollmentId: enrollment.id, passed: true, assessment: { kind: "GRADED" } },
      distinct: ["assessmentId"],
      select: { assessmentId: true },
    }),
    // Learner-level, not enrollment-level: a certificate from an earlier
    // completed program still counts as an achievement.
    prisma.certificate.count({ where: { userId, status: "VALID" } }),
  ]);

  // "Module completed" is derived from the progress tree already in hand:
  // a module at 100%, timed by the latest completedAt among its lessons.
  const moduleCompletions: ActivityItem[] = progress.modules.flatMap((programModule) => {
    if (programModule.totalLessons === 0 || programModule.percent !== 100) return [];
    const latest = programModule.lessons.reduce<Date | null>(
      (max, lesson) => (lesson.completedAt && (!max || lesson.completedAt > max) ? lesson.completedAt : max),
      null,
    );
    return latest ? [{ kind: "module_completed" as const, label: programModule.title, occurredAt: latest }] : [];
  });

  const recentActivity: ActivityItem[] = [
    ...completedLessons
      .filter((item): item is typeof item & { completedAt: Date } => item.completedAt !== null)
      .map((item) => ({
        kind: "lesson_completed" as const,
        label: item.lesson.title,
        occurredAt: item.completedAt,
      })),
    ...submissions
      .filter((item): item is typeof item & { submittedAt: Date } => item.submittedAt !== null)
      .map((item) => ({
        kind: "assignment_submitted" as const,
        label: item.assignment.title,
        occurredAt: item.submittedAt,
      })),
    ...submissions.flatMap((item) =>
      item.review?.reviewedAt && item.review.outcome
        ? [
            {
              kind: "submission_reviewed" as const,
              label: item.assignment.title,
              occurredAt: item.review.reviewedAt,
              outcome: item.review.outcome,
            },
          ]
        : [],
    ),
    ...gradedAttempts
      .filter((item): item is typeof item & { submittedAt: Date } => item.submittedAt !== null)
      .map((item) => ({
        kind: "assessment_submitted" as const,
        label: item.assessment.title,
        occurredAt: item.submittedAt,
        scorePercent: item.scorePercent,
        passed: item.passed,
      })),
    ...moduleCompletions,
    ...enrollment.certificates.map((certificate) => ({
      kind: "certificate_issued" as const,
      label: enrollment.program.name,
      occurredAt: certificate.issuedAt,
      certificateNumber: certificate.certificateNumber,
    })),
  ]
    // Newest first. On an exact tie (a module completes at the instant its
    // last lesson does; a seed stamps many rows with one time) the larger
    // event ranks first so the cap never hides it behind the lessons that
    // produced it.
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || ACTIVITY_KIND_RANK[a.kind] - ACTIVITY_KIND_RANK[b.kind])
    .slice(0, RECENT_ACTIVITY_LIMIT);

  return {
    learnerName: user.name,
    streakDays: user.streakDays,
    enrollment: {
      id: enrollment.id,
      programId: enrollment.programId,
      programName: enrollment.program.name,
    },
    progress,
    learnerStatus: enrollment.batch
      ? deriveLearnerStatus({
          batchStart: enrollment.batch.startDate,
          batchEnd: enrollment.batch.endDate,
          now,
          progressPercent: progress.overallPercent,
          enrollmentStatus: enrollment.status,
        })
      : null,
    pendingWork,
    nextLesson: next
      ? { moduleId: next.moduleId, lessonId: next.lesson.id, lessonTitle: next.lesson.title }
      : null,
    nextStep: pickNextStep(pendingWork, next, now),
    achievements: deriveAchievements({
      streakDays: user.streakDays,
      progress,
      passedGradedAssessmentCount: passedGradedAssessments.length,
      validCertificateCount,
    }),
    recentActivity,
  };
}
