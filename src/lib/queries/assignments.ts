import "server-only";
import type { AssignmentType, SubmissionStatus, ReviewOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Cheap lookup used by guards to resolve which program an assignment
 * belongs to, before requireGrantedEnrollment can run. Mirrors
 * resolveAssessmentProgram in queries/assessments.ts. */
export async function resolveAssignmentProgram(
  assignmentId: string,
): Promise<{ programId: string; moduleId: string } | null> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { moduleId: true, module: { select: { programId: true } } },
  });
  if (!assignment) return null;
  return { programId: assignment.module.programId, moduleId: assignment.moduleId };
}

export type AssignmentInstructionStep = { step: number; title: string; description: string };
export type RubricCriterionSummary = { id: string; name: string; description: string | null; maxScore: number; order: number };
export type AssignmentResourceSummary = { id: string; name: string; fileUrl: string; fileType: string; fileSizeKB: number | null };

export type SubmissionHistoryItem = {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  githubUrl: string | null;
  notes: string | null;
  submittedAt: Date | null;
  review: { score: number | null; maxScore: number | null; outcome: ReviewOutcome | null } | null;
};

export type AssignmentDetail = {
  id: string;
  title: string;
  type: AssignmentType;
  overview: string;
  requirements: string[];
  instructions: AssignmentInstructionStep[];
  estimatedMins: number | null;
  dueAt: Date | null;
  maxAttempts: number;
  allowGithubUrl: boolean;
  resources: AssignmentResourceSummary[];
  rubricCriteria: RubricCriterionSummary[];
  submissions: SubmissionHistoryItem[]; // real attempts only — NOT_STARTED excluded, see Rules
  programId: string;
  programName: string;
  moduleTitle: string;
};

/** One query: assignment + rubric (shown BEFORE submitting) + resources +
 * this enrollment's real submission history (NOT_STARTED rows are seed
 * placeholders, never rendered — see canSubmitNewAttempt/nextAttemptNumber
 * below for why they still matter to the write path). */
export async function getAssignmentDetail(
  assignmentId: string,
  enrollmentId: string,
): Promise<AssignmentDetail | null> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      title: true,
      type: true,
      overview: true,
      requirements: true,
      instructions: true,
      estimatedMins: true,
      dueAt: true,
      maxAttempts: true,
      allowGithubUrl: true,
      module: {
        select: {
          title: true,
          programId: true,
          program: { select: { name: true } },
        },
      },
      resources: {
        select: { id: true, name: true, fileUrl: true, fileType: true, fileSizeKB: true },
      },
      rubricCriteria: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, description: true, maxScore: true, order: true },
      },
      submissions: {
        where: { enrollmentId, status: { not: "NOT_STARTED" } },
        orderBy: { attemptNumber: "asc" },
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          githubUrl: true,
          notes: true,
          submittedAt: true,
          review: { select: { score: true, maxScore: true, outcome: true } },
        },
      },
    },
  });
  if (!assignment) return null;

  return {
    id: assignment.id,
    title: assignment.title,
    type: assignment.type,
    overview: assignment.overview,
    requirements: assignment.requirements,
    // instructions is admin/seed-authored Json, not user input — trusted cast.
    instructions: assignment.instructions as unknown as AssignmentInstructionStep[],
    estimatedMins: assignment.estimatedMins,
    dueAt: assignment.dueAt,
    maxAttempts: assignment.maxAttempts,
    allowGithubUrl: assignment.allowGithubUrl,
    resources: assignment.resources,
    rubricCriteria: assignment.rubricCriteria,
    submissions: assignment.submissions,
    programId: assignment.module.programId,
    programName: assignment.module.program.name,
    moduleTitle: assignment.module.title,
  };
}

/** Pure — no DB. Shared by the assignment page (render decision) and
 * submitAssignment (guard) so the rule lives in exactly one place. */
export function nextAttemptNumber(realSubmissions: Pick<SubmissionHistoryItem, "attemptNumber">[]): number {
  if (realSubmissions.length === 0) return 1;
  return Math.max(...realSubmissions.map((s) => s.attemptNumber)) + 1;
}

/** Pure — no DB. SUBMITTED/UNDER_REVIEW always block (awaiting review).
 * REVISION_REQUESTED always permits a new attempt, bypassing maxAttempts —
 * a mentor-requested revision isn't the same thing as the learner using up
 * their own attempts. Otherwise (no submissions yet, or REVIEWED) the
 * numeric cap governs. */
export function canSubmitNewAttempt(
  realSubmissions: Pick<SubmissionHistoryItem, "attemptNumber" | "status">[],
  maxAttempts: number,
): boolean {
  const latest = realSubmissions.at(-1);
  if (!latest) return true;
  if (latest.status === "SUBMITTED" || latest.status === "UNDER_REVIEW") return false;
  if (latest.status === "REVISION_REQUESTED") return true;
  return realSubmissions.length < maxAttempts;
}

export type SubmissionWithReview = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  enrollmentId: string;
  userId: string; // for the [id] page's ownership check — never rendered
  attemptNumber: number;
  status: SubmissionStatus;
  githubUrl: string | null;
  fileUrl: string | null;
  notes: string | null;
  submittedAt: Date | null;
  review: {
    overallFeedback: string;
    score: number | null;
    maxScore: number | null;
    outcome: ReviewOutcome | null;
    reviewedAt: Date | null;
    mentorName: string;
    rubricScores: { criterionId: string; criterionName: string; maxScore: number; order: number; score: number }[];
  } | null;
};

/** One query: submission + assignment title + owning enrollment's userId
 * (the actual ownership check, cheaper than a second lookup) + review with
 * mentor name and rubric scores joined to their criteria. */
export async function getSubmissionWithReview(submissionId: string): Promise<SubmissionWithReview | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      assignmentId: true,
      enrollmentId: true,
      attemptNumber: true,
      status: true,
      githubUrl: true,
      fileUrl: true,
      notes: true,
      submittedAt: true,
      assignment: { select: { title: true } },
      enrollment: { select: { userId: true } },
      review: {
        select: {
          overallFeedback: true,
          score: true,
          maxScore: true,
          outcome: true,
          reviewedAt: true,
          mentor: { select: { name: true } },
          rubricScores: {
            orderBy: { criterion: { order: "asc" } },
            select: {
              score: true,
              criterion: { select: { id: true, name: true, maxScore: true, order: true } },
            },
          },
        },
      },
    },
  });
  if (!submission) return null;

  return {
    id: submission.id,
    assignmentId: submission.assignmentId,
    assignmentTitle: submission.assignment.title,
    enrollmentId: submission.enrollmentId,
    userId: submission.enrollment.userId,
    attemptNumber: submission.attemptNumber,
    status: submission.status,
    githubUrl: submission.githubUrl,
    fileUrl: submission.fileUrl,
    notes: submission.notes,
    submittedAt: submission.submittedAt,
    review: submission.review
      ? {
          overallFeedback: submission.review.overallFeedback,
          score: submission.review.score,
          maxScore: submission.review.maxScore,
          outcome: submission.review.outcome,
          reviewedAt: submission.review.reviewedAt,
          mentorName: submission.review.mentor.name,
          rubricScores: submission.review.rubricScores.map((rs) => ({
            criterionId: rs.criterion.id,
            criterionName: rs.criterion.name,
            maxScore: rs.criterion.maxScore,
            order: rs.criterion.order,
            score: rs.score,
          })),
        }
      : null,
  };
}
