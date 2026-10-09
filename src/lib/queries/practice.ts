import "server-only";
import type { AttemptStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveAssessmentPending, deriveAssignmentPending } from "@/lib/queries/pending-work";

/** Phase A — /learn/practice. PUBLISHED assessments with kind PRACTICE
 * across every program the learner has a GRANTED enrollment in, grouped
 * program → module, with this learner's attempts summarised. Attempts are
 * matched by user (a learner holds one enrollment per program in the MVP;
 * two enrollments in the same program would merge their attempts here). */

export type PracticeAssessmentItem = {
  id: string;
  title: string;
  timeLimitMins: number | null;
  /** 0 = unlimited (Assessment.allowedAttempts). */
  allowedAttempts: number;
  /** SUBMITTED + GRADED attempts. */
  attemptsUsed: number;
  /** Highest scorePercent over graded attempts; null when none. */
  bestScorePercent: number | null;
  inProgress: boolean;
  attemptsExhausted: boolean;
  /** The existing assessment flow (its page resumes an in-progress attempt). */
  href: string;
};

export type PracticeModuleGroup = {
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  items: PracticeAssessmentItem[];
};

export type PracticeProgramGroup = {
  programId: string;
  programName: string;
  modules: PracticeModuleGroup[];
};

/** One query, grouped in memory. */
export async function getPracticeAssessments(userId: string): Promise<PracticeProgramGroup[]> {
  const assessments = await prisma.assessment.findMany({
    where: {
      kind: "PRACTICE",
      status: "PUBLISHED",
      module: { program: { enrollments: { some: { userId, accessState: "GRANTED" } } } },
    },
    orderBy: [{ module: { program: { name: "asc" } } }, { module: { order: "asc" } }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      timeLimitMins: true,
      allowedAttempts: true,
      module: {
        select: { id: true, title: true, order: true, program: { select: { id: true, name: true } } },
      },
      attempts: {
        where: { enrollment: { userId } },
        select: { status: true, scorePercent: true },
      },
    },
  });

  const programs = new Map<string, PracticeProgramGroup>();
  for (const assessment of assessments) {
    const program = assessment.module.program;
    const programGroup = programs.get(program.id) ?? { programId: program.id, programName: program.name, modules: [] };
    programs.set(program.id, programGroup);

    let moduleGroup = programGroup.modules.find((m) => m.moduleId === assessment.module.id);
    if (!moduleGroup) {
      moduleGroup = {
        moduleId: assessment.module.id,
        moduleTitle: assessment.module.title,
        moduleOrder: assessment.module.order,
        items: [],
      };
      programGroup.modules.push(moduleGroup);
    }

    const finished = assessment.attempts.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED");
    const graded = assessment.attempts.filter((a) => a.status === "GRADED" && a.scorePercent !== null);
    const bestScorePercent = graded.length === 0 ? null : Math.max(...graded.map((a) => a.scorePercent ?? 0));
    const inProgress = assessment.attempts.some((a) => a.status === "IN_PROGRESS");
    const attemptsExhausted =
      !inProgress && assessment.allowedAttempts !== 0 && finished.length >= assessment.allowedAttempts;

    moduleGroup.items.push({
      id: assessment.id,
      title: assessment.title,
      timeLimitMins: assessment.timeLimitMins,
      allowedAttempts: assessment.allowedAttempts,
      attemptsUsed: finished.length,
      bestScorePercent,
      inProgress,
      attemptsExhausted,
      href: `/learn/assessments/${assessment.id}`,
    });
  }

  return [...programs.values()];
}

/** /learn/practice (practice_hub_lumoraspace). Everything a learner can
 * practise on, flat: quizzes (PRACTICE assessments), assessments (GRADED),
 * assignments and projects — across every GRANTED enrollment, PUBLISHED
 * modules only (the same "published assignment" rule as getPendingWork). */

export type PracticeActivityKind = "quiz" | "assessment" | "assignment" | "project";

export type PracticeActivityStatus =
  | "in_progress"
  | "revision_requested"
  | "overdue"
  | "not_started"
  | "not_passed"
  | "under_review"
  | "completed";

export type PracticeActivity = {
  /** Unique across kinds and enrollments — a React key. */
  key: string;
  kind: PracticeActivityKind;
  title: string;
  programName: string;
  moduleOrder: number;
  /** Assignment.estimatedMins, or an assessment's timeLimitMins. */
  durationMins: number | null;
  /** Assessments only. */
  questionCount: number | null;
  status: PracticeActivityStatus;
  actionLabel: string;
  href: string;
  /** A finished assessment that can still be retaken: the overview page. */
  retakeHref: string | null;
};

type AssessmentAttempt = { id: string; status: AttemptStatus; passed: boolean | null };

/** Pure. `attempts` ordered attemptNumber desc. Reuses deriveAssessmentPending
 * for the open states; its `null` ("passed") becomes `completed` here, since
 * the hub lists finished work too. */
export function derivePracticeAssessment(
  assessmentId: string,
  attempts: AssessmentAttempt[],
  allowedAttempts: number,
  passingScorePercent: number | null,
): Pick<PracticeActivity, "status" | "actionLabel" | "href" | "retakeHref"> {
  const overviewHref = `/learn/assessments/${assessmentId}`;
  const finished = attempts.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED");
  const attemptsRemain = allowedAttempts === 0 || finished.length < allowedAttempts;
  const pending = deriveAssessmentPending(assessmentId, attempts, allowedAttempts, passingScorePercent);

  if (pending === null || pending.state === "completed") {
    const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
    if (inProgress) {
      return { status: "in_progress", actionLabel: "Continue", href: `/learn/attempts/${inProgress.id}`, retakeHref: null };
    }
    return {
      status: "completed",
      actionLabel: "Review",
      href: finished[0] ? `/learn/attempts/${finished[0].id}` : overviewHref,
      retakeHref: attemptsRemain ? overviewHref : null,
    };
  }
  if (pending.action === "continue") {
    return { status: "in_progress", actionLabel: "Continue", href: pending.href, retakeHref: null };
  }
  if (pending.action === "resubmit") {
    return { status: "not_passed", actionLabel: "Try Again", href: pending.href, retakeHref: null };
  }
  return { status: "not_started", actionLabel: "Start", href: pending.href, retakeHref: null };
}

/** Pure. `latest` = the newest real submission (NOT_STARTED placeholders excluded). */
export function derivePracticeAssignment(
  assignmentId: string,
  latest: { id: string; status: SubmissionStatus } | undefined,
  dueAt: Date | null,
  now: Date,
): Pick<PracticeActivity, "status" | "actionLabel" | "href" | "retakeHref"> {
  const pending = deriveAssignmentPending(assignmentId, latest, dueAt, now);
  const submissionHref = latest ? `/learn/submissions/${latest.id}` : pending.href;
  switch (pending.state) {
    case "submitted":
    case "under_review":
      return { status: "under_review", actionLabel: "View Submission", href: submissionHref, retakeHref: null };
    case "revision_requested":
      return { status: "revision_requested", actionLabel: "Resubmit", href: pending.href, retakeHref: null };
    case "completed":
      return { status: "completed", actionLabel: "Review", href: submissionHref, retakeHref: null };
    case "overdue":
      return { status: "overdue", actionLabel: "Start", href: pending.href, retakeHref: null };
    default:
      return { status: "not_started", actionLabel: "Start", href: pending.href, retakeHref: null };
  }
}

// What to do next, most urgent first; finished and waiting-on-a-mentor last.
const PRACTICE_STATUS_RANK: Record<PracticeActivityStatus, number> = {
  in_progress: 0,
  revision_requested: 1,
  overdue: 2,
  not_started: 3,
  not_passed: 4,
  under_review: 5,
  completed: 6,
};

/** Pure. True for the statuses the learner can act on right now. */
export function isActionablePractice(status: PracticeActivityStatus): boolean {
  return PRACTICE_STATUS_RANK[status] <= PRACTICE_STATUS_RANK.not_passed;
}

/** ONE query. Sorted by urgency (PRACTICE_STATUS_RANK), then program, module
 * order, title — so `find(isActionablePractice)` on the result is "Next Up". */
export async function getPracticeActivities(userId: string, now: Date): Promise<PracticeActivity[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, accessState: "GRANTED" },
    select: {
      id: true,
      program: {
        select: {
          name: true,
          modules: {
            where: { status: "PUBLISHED" },
            orderBy: { order: "asc" },
            select: {
              order: true,
              assignments: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  dueAt: true,
                  estimatedMins: true,
                  // This learner's rows only; split per enrollment below.
                  submissions: {
                    where: { enrollment: { userId }, status: { not: "NOT_STARTED" } },
                    orderBy: { attemptNumber: "desc" },
                    select: { id: true, status: true, enrollmentId: true },
                  },
                },
              },
              assessments: {
                where: { status: "PUBLISHED" },
                select: {
                  id: true,
                  title: true,
                  kind: true,
                  timeLimitMins: true,
                  allowedAttempts: true,
                  passingScorePercent: true,
                  attempts: {
                    where: { enrollment: { userId } },
                    orderBy: { attemptNumber: "desc" },
                    select: { id: true, status: true, passed: true, enrollmentId: true },
                  },
                  _count: { select: { questions: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const activities: PracticeActivity[] = [];
  for (const enrollment of enrollments) {
    for (const programModule of enrollment.program.modules) {
      for (const assignment of programModule.assignments) {
        const latest = assignment.submissions.find((submission) => submission.enrollmentId === enrollment.id);
        activities.push({
          key: `${enrollment.id}:assignment:${assignment.id}`,
          kind: assignment.type === "PROJECT" ? "project" : "assignment",
          title: assignment.title,
          programName: enrollment.program.name,
          moduleOrder: programModule.order,
          durationMins: assignment.estimatedMins,
          questionCount: null,
          ...derivePracticeAssignment(assignment.id, latest, assignment.dueAt, now),
        });
      }
      for (const assessment of programModule.assessments) {
        activities.push({
          key: `${enrollment.id}:assessment:${assessment.id}`,
          kind: assessment.kind === "PRACTICE" ? "quiz" : "assessment",
          title: assessment.title,
          programName: enrollment.program.name,
          moduleOrder: programModule.order,
          durationMins: assessment.timeLimitMins,
          questionCount: assessment._count.questions,
          ...derivePracticeAssessment(
            assessment.id,
            assessment.attempts.filter((attempt) => attempt.enrollmentId === enrollment.id),
            assessment.allowedAttempts,
            assessment.passingScorePercent,
          ),
        });
      }
    }
  }

  return activities.sort(
    (a, b) =>
      PRACTICE_STATUS_RANK[a.status] - PRACTICE_STATUS_RANK[b.status] ||
      a.programName.localeCompare(b.programName) ||
      a.moduleOrder - b.moduleOrder ||
      a.title.localeCompare(b.title),
  );
}