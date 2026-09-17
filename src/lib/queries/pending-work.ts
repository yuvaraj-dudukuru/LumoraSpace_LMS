import "server-only";
import type { AssignmentType, AttemptStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Phase A — everything a learner still owes (or has finished) in ONE
 * program, for ONE enrollment: every assignment in a PUBLISHED module, plus
 * every PUBLISHED GRADED assessment they haven't passed yet. One query,
 * bounded nested selects, then pure derivation. `Assignment` has no status
 * column, so "published assignment" means "assignment whose module is
 * PUBLISHED" — see docs/CONTRACTS.md. */

export type PendingWorkState =
  | "not_started"
  | "overdue"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "completed";

export type PendingWorkAction = "start" | "continue" | "view_feedback" | "resubmit";

export const PENDING_WORK_ACTION_LABEL: Record<PendingWorkAction, string> = {
  start: "Start",
  continue: "Continue",
  view_feedback: "View feedback",
  resubmit: "Resubmit",
};

export type PendingWorkItem = {
  kind: "assignment" | "assessment";
  id: string;
  title: string;
  moduleTitle: string;
  moduleOrder: number;
  /** Assignment.type for the kind chip; null for an assessment. */
  assignmentType: AssignmentType | null;
  /** Assessments have no due date in the schema — always null for them. */
  dueAt: Date | null;
  /** Assignment.estimatedMins, or an assessment's timeLimitMins. */
  estimatedMins: number | null;
  state: PendingWorkState;
  action: PendingWorkAction;
  href: string;
};

type LatestSubmission = { id: string; status: SubmissionStatus } | undefined;

/** Pure. The latest REAL submission (a NOT_STARTED placeholder row counts
 * as none — the query below already excludes it). */
export function deriveAssignmentPending(
  assignmentId: string,
  latest: LatestSubmission,
  dueAt: Date | null,
  now: Date,
): { state: PendingWorkState; action: PendingWorkAction; href: string } {
  const assignmentHref = `/learn/assignments/${assignmentId}`;
  if (!latest) {
    const overdue = dueAt !== null && dueAt.getTime() < now.getTime();
    return { state: overdue ? "overdue" : "not_started", action: "start", href: assignmentHref };
  }
  switch (latest.status) {
    case "SUBMITTED":
      return { state: "submitted", action: "continue", href: assignmentHref };
    case "UNDER_REVIEW":
      return { state: "under_review", action: "continue", href: assignmentHref };
    case "REVISION_REQUESTED":
      return { state: "revision_requested", action: "resubmit", href: assignmentHref };
    case "REVIEWED":
      return { state: "completed", action: "view_feedback", href: `/learn/submissions/${latest.id}` };
    default:
      // NOT_STARTED can't reach here (filtered in the query) — treat as none.
      return { state: dueAt !== null && dueAt.getTime() < now.getTime() ? "overdue" : "not_started", action: "start", href: assignmentHref };
  }
}

type AttemptRow = { id: string; status: AttemptStatus; passed: boolean | null };

/** Pure. Returns null when the assessment counts as passed (excluded from
 * pending work): any attempt with passed === true, or — when there is no
 * passing threshold — any graded attempt, mirroring the quiz-completion
 * rule in submitAttempt. Otherwise maps to the spec's states/actions only:
 *   no attempts                      → not_started / Start   → /learn/assessments/{id}
 *   an IN_PROGRESS attempt           → not_started / Continue → /learn/attempts/{attemptId}
 *   failed, attempts remaining       → not_started / Resubmit → /learn/assessments/{id}
 *   failed, no attempts remaining    → completed  / View feedback → /learn/attempts/{latest}
 * `attempts` must be ordered attemptNumber desc. */
export function deriveAssessmentPending(
  assessmentId: string,
  attempts: AttemptRow[],
  allowedAttempts: number,
  passingScorePercent: number | null,
): { state: PendingWorkState; action: PendingWorkAction; href: string } | null {
  const finished = attempts.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED");
  const passed =
    attempts.some((a) => a.passed === true) ||
    (passingScorePercent === null && attempts.some((a) => a.status === "GRADED"));
  if (passed) return null;

  const assessmentHref = `/learn/assessments/${assessmentId}`;
  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) return { state: "not_started", action: "continue", href: `/learn/attempts/${inProgress.id}` };
  if (finished.length === 0) return { state: "not_started", action: "start", href: assessmentHref };

  const attemptsRemain = allowedAttempts === 0 || finished.length < allowedAttempts;
  if (attemptsRemain) return { state: "not_started", action: "resubmit", href: assessmentHref };
  return { state: "completed", action: "view_feedback", href: `/learn/attempts/${finished[0].id}` };
}

const STATE_RANK: Record<PendingWorkState, number> = {
  revision_requested: 0,
  overdue: 1,
  not_started: 2,
  submitted: 2,
  under_review: 2,
  completed: 3,
};

/** Pure. Revision requested → overdue → everything open (by due date, no
 * due date last) → completed last. Ties: module order, then title. */
export function sortPendingWork(items: PendingWorkItem[]): PendingWorkItem[] {
  return [...items].sort((a, b) => {
    const rank = STATE_RANK[a.state] - STATE_RANK[b.state];
    if (rank !== 0) return rank;
    const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    return a.title.localeCompare(b.title);
  });
}

/** One query: this enrollment's program → PUBLISHED modules → assignments
 * (with this enrollment's latest real submission) + PUBLISHED GRADED
 * assessments (with this enrollment's attempts). Returns items in module /
 * title order — callers sort with sortPendingWork. */
export async function getPendingWork(enrollmentId: string, now: Date): Promise<PendingWorkItem[]> {
  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: {
      program: {
        select: {
          modules: {
            where: { status: "PUBLISHED" },
            orderBy: { order: "asc" },
            select: {
              title: true,
              order: true,
              assignments: {
                orderBy: { title: "asc" },
                select: {
                  id: true,
                  title: true,
                  type: true,
                  dueAt: true,
                  estimatedMins: true,
                  submissions: {
                    where: { enrollmentId, status: { not: "NOT_STARTED" } },
                    orderBy: { attemptNumber: "desc" },
                    take: 1,
                    select: { id: true, status: true },
                  },
                },
              },
              assessments: {
                where: { kind: "GRADED", status: "PUBLISHED" },
                orderBy: { title: "asc" },
                select: {
                  id: true,
                  title: true,
                  timeLimitMins: true,
                  allowedAttempts: true,
                  passingScorePercent: true,
                  attempts: {
                    where: { enrollmentId },
                    orderBy: { attemptNumber: "desc" },
                    select: { id: true, status: true, passed: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const items: PendingWorkItem[] = [];
  for (const programModule of enrollment.program.modules) {
    for (const assignment of programModule.assignments) {
      const derived = deriveAssignmentPending(assignment.id, assignment.submissions[0], assignment.dueAt, now);
      items.push({
        kind: "assignment",
        id: assignment.id,
        title: assignment.title,
        moduleTitle: programModule.title,
        moduleOrder: programModule.order,
        assignmentType: assignment.type,
        dueAt: assignment.dueAt,
        estimatedMins: assignment.estimatedMins,
        ...derived,
      });
    }
    for (const assessment of programModule.assessments) {
      const derived = deriveAssessmentPending(
        assessment.id,
        assessment.attempts,
        assessment.allowedAttempts,
        assessment.passingScorePercent,
      );
      if (!derived) continue; // passed — not pending
      items.push({
        kind: "assessment",
        id: assessment.id,
        title: assessment.title,
        moduleTitle: programModule.title,
        moduleOrder: programModule.order,
        assignmentType: null,
        dueAt: null,
        estimatedMins: assessment.timeLimitMins,
        ...derived,
      });
    }
  }
  return items;
}
