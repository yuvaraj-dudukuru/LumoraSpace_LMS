import "server-only";
import type { Role, SubmissionStatus, ReviewOutcome, AssignmentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProgramProgress, type ProgramProgress } from "@/lib/queries/progress";

/** A learner with no activity signal at all in this many days (or ever)
 * counts as "needs attention" — chosen since the task didn't specify a
 * number; the task's own 6-day queue-urgency threshold is separate and
 * lives in getReviewQueue's caller (the submissions page). */
export const NEEDS_ATTENTION_STALE_DAYS = 7;

/** Batch ids the caller can see. ADMIN gets every batch in the system;
 * MENTOR gets only batches with a MentorAssignment row. Every other query in
 * this file takes the resulting array as a plain argument and filters by it
 * — none of them re-check role themselves. */
export async function getMentorBatchIds(user: Pick<{ id: string; role: Role }, "id" | "role">): Promise<string[]> {
  if (user.role === "ADMIN") {
    const batches = await prisma.batch.findMany({ select: { id: true } });
    return batches.map((batch) => batch.id);
  }
  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId: user.id },
    select: { batchId: true },
  });
  return assignments.map((assignment) => assignment.batchId);
}

type EnrollmentActivity = {
  enrollmentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  programId: string;
  programName: string;
  batchId: string;
  batchName: string;
  progressPercent: number;
  lastActiveAt: Date | null;
  hasFailedAttempt: boolean;
  hasOutstandingRevision: boolean;
  unreviewedSubmissionCount: number;
};

/** Shared by getMentorDashboard and getMentorLearners so the "what counts as
 * activity / at risk" rule lives in exactly one place. One query — bounded
 * nested selects (lessonProgress/submissions/attempts per enrollment), same
 * shape as every other milestone's progress queries, not a per-learner loop. */
async function getBatchEnrollmentsWithActivity(batchIds: string[]): Promise<EnrollmentActivity[]> {
  if (batchIds.length === 0) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: { batchId: { in: batchIds } },
    select: {
      id: true,
      userId: true,
      programId: true,
      progressPercent: true,
      user: { select: { name: true, email: true } },
      program: { select: { name: true } },
      batch: { select: { id: true, name: true } },
      lessonProgress: {
        where: { completed: true },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: { completedAt: true },
      },
      submissions: {
        select: { assignmentId: true, attemptNumber: true, submittedAt: true, status: true },
      },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { assessmentId: true, attemptNumber: true, startedAt: true, passed: true },
      },
    },
  });

  // batchId is nullable at the schema level (self-paced, future); every row
  // matched by `batchId: { in: batchIds }` necessarily has one, but Prisma's
  // relation type doesn't encode that — narrow it explicitly rather than
  // asserting.
  const withBatch = enrollments.filter(
    (enrollment): enrollment is typeof enrollment & { batch: NonNullable<(typeof enrollment)["batch"]> } =>
      enrollment.batch !== null,
  );

  return withBatch.map((enrollment) => {
    const timestamps: Date[] = [
      ...enrollment.lessonProgress.map((lp) => lp.completedAt).filter((d): d is Date => d !== null),
      ...enrollment.submissions.map((s) => s.submittedAt).filter((d): d is Date => d !== null),
      ...enrollment.attempts.map((a) => a.startedAt),
    ];
    const lastActiveAt = timestamps.length === 0 ? null : new Date(Math.max(...timestamps.map((d) => d.getTime())));

    // Only the latest attempt per assessment counts toward "failed" — an
    // earlier fail followed by a later pass isn't a standing problem.
    const latestAttemptByAssessment = new Map<string, { attemptNumber: number; passed: boolean | null }>();
    for (const attempt of enrollment.attempts) {
      const existing = latestAttemptByAssessment.get(attempt.assessmentId);
      if (!existing || attempt.attemptNumber > existing.attemptNumber) {
        latestAttemptByAssessment.set(attempt.assessmentId, attempt);
      }
    }
    const hasFailedAttempt = [...latestAttemptByAssessment.values()].some((a) => a.passed === false);

    // Same idea per assignment for outstanding revision requests / unreviewed work.
    const latestSubmissionByAssignment = new Map<string, { attemptNumber: number; status: SubmissionStatus }>();
    for (const submission of enrollment.submissions) {
      const existing = latestSubmissionByAssignment.get(submission.assignmentId);
      if (!existing || submission.attemptNumber > existing.attemptNumber) {
        latestSubmissionByAssignment.set(submission.assignmentId, submission);
      }
    }
    const latestSubmissions = [...latestSubmissionByAssignment.values()];
    const hasOutstandingRevision = latestSubmissions.some((s) => s.status === "REVISION_REQUESTED");
    const unreviewedSubmissionCount = latestSubmissions.filter(
      (s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW",
    ).length;

    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      userName: enrollment.user.name,
      userEmail: enrollment.user.email,
      programId: enrollment.programId,
      programName: enrollment.program.name,
      batchId: enrollment.batch.id,
      batchName: enrollment.batch.name,
      progressPercent: enrollment.progressPercent,
      lastActiveAt,
      hasFailedAttempt,
      hasOutstandingRevision,
      unreviewedSubmissionCount,
    };
  });
}

export type AtRiskReason = "stale" | "failed_attempt" | "revision_outstanding";

export type MentorAtRiskLearner = {
  userId: string;
  userName: string;
  programName: string;
  progressPercent: number;
  lastActiveAt: Date | null;
  daysSinceActive: number | null;
  reasons: AtRiskReason[];
};

export type MentorDashboard = {
  pendingReviewCount: number;
  atRiskLearners: MentorAtRiskLearner[];
  upcomingDueDates: { assignmentId: string; title: string; programName: string; dueAt: Date }[];
  recentActivity: { submissionId: string; learnerName: string; assignmentTitle: string; submittedAt: Date }[];
};

export async function getMentorDashboard(batchIds: string[]): Promise<MentorDashboard> {
  if (batchIds.length === 0) {
    return { pendingReviewCount: 0, atRiskLearners: [], upcomingDueDates: [], recentActivity: [] };
  }

  const [pendingReviewCount, enrollmentsActivity, batches, recentSubmissions] = await Promise.all([
    prisma.submission.count({
      where: { enrollment: { batchId: { in: batchIds } }, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }),
    getBatchEnrollmentsWithActivity(batchIds),
    prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { programId: true } }),
    prisma.submission.findMany({
      where: { enrollment: { batchId: { in: batchIds } }, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        submittedAt: true,
        assignment: { select: { title: true } },
        enrollment: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const programIds = [...new Set(batches.map((batch) => batch.programId))];
  const upcomingAssignments =
    programIds.length === 0
      ? []
      : await prisma.assignment.findMany({
          where: { module: { programId: { in: programIds } }, dueAt: { gt: new Date() } },
          orderBy: { dueAt: "asc" },
          take: 5,
          select: {
            id: true,
            title: true,
            dueAt: true,
            module: { select: { program: { select: { name: true } } } },
          },
        });

  const now = Date.now();
  const atRiskLearners: MentorAtRiskLearner[] = enrollmentsActivity
    .map((enrollment) => {
      const daysSinceActive = enrollment.lastActiveAt
        ? Math.floor((now - enrollment.lastActiveAt.getTime()) / 86_400_000)
        : null;
      const reasons: AtRiskReason[] = [];
      if (daysSinceActive === null || daysSinceActive >= NEEDS_ATTENTION_STALE_DAYS) reasons.push("stale");
      if (enrollment.hasFailedAttempt) reasons.push("failed_attempt");
      if (enrollment.hasOutstandingRevision) reasons.push("revision_outstanding");
      return {
        userId: enrollment.userId,
        userName: enrollment.userName,
        programName: enrollment.programName,
        progressPercent: enrollment.progressPercent,
        lastActiveAt: enrollment.lastActiveAt,
        daysSinceActive,
        reasons,
      };
    })
    .filter((learner) => learner.reasons.length > 0)
    .sort((a, b) => (b.daysSinceActive ?? Infinity) - (a.daysSinceActive ?? Infinity));

  return {
    pendingReviewCount,
    atRiskLearners,
    // dueAt is guaranteed non-null here (filtered by `gt: new Date()`), Prisma's type just doesn't narrow it.
    upcomingDueDates: upcomingAssignments.map((assignment) => ({
      assignmentId: assignment.id,
      title: assignment.title,
      programName: assignment.module.program.name,
      dueAt: assignment.dueAt as Date,
    })),
    // submittedAt is guaranteed non-null here (filtered by `not: null`).
    recentActivity: recentSubmissions.map((submission) => ({
      submissionId: submission.id,
      learnerName: submission.enrollment.user.name,
      assignmentTitle: submission.assignment.title,
      submittedAt: submission.submittedAt as Date,
    })),
  };
}

export type ReviewQueueFilter = "all" | "pending" | "under_review" | "reviewed" | "revision_requested";

const REVIEW_QUEUE_FILTER_STATUSES: Record<ReviewQueueFilter, SubmissionStatus[]> = {
  all: ["SUBMITTED", "UNDER_REVIEW", "REVIEWED", "REVISION_REQUESTED"],
  pending: ["SUBMITTED"],
  under_review: ["UNDER_REVIEW"],
  reviewed: ["REVIEWED"],
  revision_requested: ["REVISION_REQUESTED"],
};

export type ReviewQueueItem = {
  id: string;
  learnerName: string;
  assignmentTitle: string;
  programName: string;
  attemptNumber: number;
  status: SubmissionStatus;
  submittedAt: Date | null;
  ageDays: number | null;
};

/** SUBMITTED/UNDER_REVIEW always included; REVIEWED (and REVISION_REQUESTED)
 * only surface when `filter` asks for them. Oldest-first — the queue is a
 * to-do list, not a feed. */
export async function getReviewQueue(batchIds: string[], filter: ReviewQueueFilter): Promise<ReviewQueueItem[]> {
  if (batchIds.length === 0) return [];

  const submissions = await prisma.submission.findMany({
    where: {
      enrollment: { batchId: { in: batchIds } },
      status: { in: REVIEW_QUEUE_FILTER_STATUSES[filter] },
    },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      submittedAt: true,
      assignment: { select: { title: true } },
      enrollment: { select: { user: { select: { name: true } }, program: { select: { name: true } } } },
    },
  });

  const now = Date.now();
  return submissions.map((submission) => ({
    id: submission.id,
    learnerName: submission.enrollment.user.name,
    assignmentTitle: submission.assignment.title,
    programName: submission.enrollment.program.name,
    attemptNumber: submission.attemptNumber,
    status: submission.status,
    submittedAt: submission.submittedAt,
    ageDays: submission.submittedAt ? Math.floor((now - submission.submittedAt.getTime()) / 86_400_000) : null,
  }));
}

export type PriorSubmissionSummary = {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  outcome: ReviewOutcome | null;
};

export type SubmissionForReview = {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  githubUrl: string | null;
  notes: string | null;
  submittedAt: Date | null;
  batchId: string;
  learner: { id: string; name: string; email: string };
  assignment: {
    id: string;
    title: string;
    type: AssignmentType;
    requirements: string[];
    rubricCriteria: { id: string; name: string; description: string | null; maxScore: number; order: number }[];
  };
  priorSubmissions: PriorSubmissionSummary[];
  /** Raw — including whichever mentor owns an in-progress draft. The PAGE,
   * not this query, decides whether to render `overallFeedback`/
   * `rubricScores` to the current viewer (never another mentor's draft) —
   * see docs/CONTRACTS.md. */
  review: {
    mentorId: string;
    mentorName: string;
    overallFeedback: string;
    outcome: ReviewOutcome | null;
    reviewedAt: Date | null;
    score: number | null;
    maxScore: number | null;
    rubricScores: { criterionId: string; score: number }[];
  } | null;
};

export async function getSubmissionForReview(submissionId: string): Promise<SubmissionForReview | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      enrollmentId: true,
      assignmentId: true,
      attemptNumber: true,
      status: true,
      githubUrl: true,
      notes: true,
      submittedAt: true,
      enrollment: {
        select: {
          batchId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          type: true,
          requirements: true,
          rubricCriteria: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, description: true, maxScore: true, order: true },
          },
        },
      },
      review: {
        select: {
          mentorId: true,
          mentor: { select: { name: true } },
          overallFeedback: true,
          outcome: true,
          reviewedAt: true,
          score: true,
          maxScore: true,
          rubricScores: { select: { criterionId: true, score: true } },
        },
      },
    },
  });
  if (!submission || !submission.enrollment.batchId) return null;

  const priorSubmissions = await prisma.submission.findMany({
    where: {
      assignmentId: submission.assignmentId,
      enrollmentId: submission.enrollmentId,
      status: { not: "NOT_STARTED" },
      id: { not: submission.id },
    },
    orderBy: { attemptNumber: "asc" },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      review: { select: { score: true, maxScore: true, outcome: true } },
    },
  });

  return {
    id: submission.id,
    attemptNumber: submission.attemptNumber,
    status: submission.status,
    githubUrl: submission.githubUrl,
    notes: submission.notes,
    submittedAt: submission.submittedAt,
    batchId: submission.enrollment.batchId,
    learner: submission.enrollment.user,
    assignment: submission.assignment,
    priorSubmissions: priorSubmissions.map((prior) => ({
      id: prior.id,
      attemptNumber: prior.attemptNumber,
      status: prior.status,
      score: prior.review?.score ?? null,
      maxScore: prior.review?.maxScore ?? null,
      outcome: prior.review?.outcome ?? null,
    })),
    review: submission.review
      ? {
          mentorId: submission.review.mentorId,
          mentorName: submission.review.mentor.name,
          overallFeedback: submission.review.overallFeedback,
          outcome: submission.review.outcome,
          reviewedAt: submission.review.reviewedAt,
          score: submission.review.score,
          maxScore: submission.review.maxScore,
          rubricScores: submission.review.rubricScores,
        }
      : null,
  };
}

export type MentorLearnerRow = {
  userId: string;
  name: string;
  email: string;
  programName: string;
  batchName: string;
  progressPercent: number;
  lastActiveAt: Date | null;
  outstandingItemsCount: number;
  needsAttention: boolean;
};

export async function getMentorLearners(
  batchIds: string[],
  query?: { search?: string; status?: "all" | "needs_attention" },
): Promise<MentorLearnerRow[]> {
  if (batchIds.length === 0) return [];

  const activity = await getBatchEnrollmentsWithActivity(batchIds);
  const now = Date.now();

  let rows: MentorLearnerRow[] = activity.map((enrollment) => {
    const daysSinceActive = enrollment.lastActiveAt
      ? Math.floor((now - enrollment.lastActiveAt.getTime()) / 86_400_000)
      : null;
    const stale = daysSinceActive === null || daysSinceActive >= NEEDS_ATTENTION_STALE_DAYS;
    const outstandingItemsCount =
      enrollment.unreviewedSubmissionCount +
      (enrollment.hasOutstandingRevision ? 1 : 0) +
      (enrollment.hasFailedAttempt ? 1 : 0);
    return {
      userId: enrollment.userId,
      name: enrollment.userName,
      email: enrollment.userEmail,
      programName: enrollment.programName,
      batchName: enrollment.batchName,
      progressPercent: enrollment.progressPercent,
      lastActiveAt: enrollment.lastActiveAt,
      outstandingItemsCount,
      needsAttention: stale || enrollment.hasFailedAttempt || enrollment.hasOutstandingRevision,
    };
  });

  if (query?.search) {
    const needle = query.search.toLowerCase();
    rows = rows.filter(
      (row) => row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle),
    );
  }
  if (query?.status === "needs_attention") {
    rows = rows.filter((row) => row.needsAttention);
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export type LearnerEnrollmentDetail = {
  enrollmentId: string;
  programId: string;
  programName: string;
  batchName: string;
  accessState: string;
  progress: ProgramProgress;
  submissions: {
    id: string;
    assignmentTitle: string;
    attemptNumber: number;
    status: SubmissionStatus;
    submittedAt: Date | null;
  }[];
};

export type LearnerDetail = {
  userId: string;
  name: string;
  email: string;
  lastActiveAt: Date | null;
  enrollments: LearnerEnrollmentDetail[];
};

/** Returns null if the learner has no enrollment in any batch the caller can
 * see — including when the userId doesn't exist at all. Both cases must
 * look identical to the caller; never leak which one it was. */
export async function getLearnerDetail(userId: string, batchIds: string[]): Promise<LearnerDetail | null> {
  if (batchIds.length === 0) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId, batchId: { in: batchIds } },
    select: {
      id: true,
      programId: true,
      accessState: true,
      program: { select: { name: true } },
      batch: { select: { name: true } },
      submissions: {
        where: { status: { not: "NOT_STARTED" } },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          submittedAt: true,
          assignment: { select: { title: true } },
        },
      },
    },
  });
  if (enrollments.length === 0) return null;

  const [user, activity] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } }),
    getBatchEnrollmentsWithActivity(batchIds),
  ]);

  const myTimestamps = activity
    .filter((enrollment) => enrollment.userId === userId)
    .map((enrollment) => enrollment.lastActiveAt)
    .filter((d): d is Date => d !== null);
  const lastActiveAt = myTimestamps.length === 0 ? null : new Date(Math.max(...myTimestamps.map((d) => d.getTime())));

  const enrollmentDetails = await Promise.all(
    enrollments.map(async (enrollment) => ({
      enrollmentId: enrollment.id,
      programId: enrollment.programId,
      programName: enrollment.program.name,
      batchName: enrollment.batch?.name ?? "—",
      accessState: enrollment.accessState,
      progress: await getProgramProgress(enrollment.id),
      submissions: enrollment.submissions.map((submission) => ({
        id: submission.id,
        assignmentTitle: submission.assignment.title,
        attemptNumber: submission.attemptNumber,
        status: submission.status,
        submittedAt: submission.submittedAt,
      })),
    })),
  );

  return { userId, name: user.name, email: user.email, lastActiveAt, enrollments: enrollmentDetails };
}
