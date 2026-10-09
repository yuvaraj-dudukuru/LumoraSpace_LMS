import "server-only";
import type { AssessmentKind, AttemptStatus, ContentStatus, QuestionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** /admin/assessments and the builder at /admin/assessments/[id]. ADMIN-only
 * callers — this is the one place correct answers are read for display, so
 * nothing here may be reused on a learner page. */

export type AdminAssessmentCounts = { total: number; published: number; draft: number; archived: number };

export type AdminAssessmentRow = {
  id: string;
  title: string;
  kind: AssessmentKind;
  status: ContentStatus;
  programId: string;
  programName: string;
  moduleOrder: number;
  moduleTitle: string;
  questionCount: number;
  attemptCount: number;
  updatedAt: Date;
};

/** `counts` are platform-wide; `rows` follow the filter, most recently updated first. */
export async function getAssessmentsForAdmin(
  filter: { status?: ContentStatus | "all"; programId?: string; search?: string } = {},
): Promise<{ counts: AdminAssessmentCounts; rows: AdminAssessmentRow[] }> {
  const [grouped, assessments] = await Promise.all([
    prisma.assessment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.assessment.findMany({
      where: {
        status: filter.status && filter.status !== "all" ? filter.status : undefined,
        module: filter.programId ? { programId: filter.programId } : undefined,
        title: filter.search ? { contains: filter.search, mode: "insensitive" } : undefined,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        kind: true,
        status: true,
        updatedAt: true,
        module: { select: { order: true, title: true, program: { select: { id: true, name: true } } } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
  ]);

  const countFor = (status: ContentStatus) => grouped.find((row) => row.status === status)?._count._all ?? 0;
  return {
    counts: {
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
      published: countFor("PUBLISHED"),
      draft: countFor("DRAFT"),
      archived: countFor("ARCHIVED"),
    },
    rows: assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      kind: assessment.kind,
      status: assessment.status,
      programId: assessment.module.program.id,
      programName: assessment.module.program.name,
      moduleOrder: assessment.module.order,
      moduleTitle: assessment.module.title,
      questionCount: assessment._count.questions,
      attemptCount: assessment._count.attempts,
      updatedAt: assessment.updatedAt,
    })),
  };
}

export type BuilderQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  text: string;
  points: number;
  explanation: string | null;
  options: { id: string; label: string; text: string; isCorrect: boolean }[];
};

export type BuilderAttempt = {
  id: string;
  learnerName: string;
  learnerEmail: string;
  attemptNumber: number;
  status: AttemptStatus;
  scorePercent: number | null;
  passed: boolean | null;
  startedAt: Date;
  submittedAt: Date | null;
};

export type AssessmentForBuilder = {
  id: string;
  title: string;
  kind: AssessmentKind;
  status: ContentStatus;
  timeLimitMins: number | null;
  passingScorePercent: number | null;
  allowedAttempts: number;
  shuffleQuestions: boolean;
  showResultsImmediately: boolean;
  module: { id: string; order: number; title: string };
  program: { id: string; name: string };
  /** The QUIZ lesson this assessment completes, if linked. */
  lesson: { id: string; title: string } | null;
  questions: BuilderQuestion[];
  totalMarks: number;
  /** Marks from MULTIPLE_CHOICE/TRUE_FALSE only — CODE_SNIPPET is never auto-graded (docs/CONTRACTS.md). */
  autoGradedMarks: number;
  /** Any attempt at all locks the question bank (see actions). */
  attemptCount: number;
  /** Newest first, capped at RESULTS_LIMIT. */
  attempts: BuilderAttempt[];
};

const RESULTS_LIMIT = 50;

export async function getAssessmentForBuilder(id: string): Promise<AssessmentForBuilder | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      timeLimitMins: true,
      passingScorePercent: true,
      allowedAttempts: true,
      shuffleQuestions: true,
      showResultsImmediately: true,
      module: { select: { id: true, order: true, title: true, program: { select: { id: true, name: true } } } },
      lesson: { select: { id: true, title: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          type: true,
          text: true,
          points: true,
          explanation: true,
          options: { orderBy: { label: "asc" }, select: { id: true, label: true, text: true, isCorrect: true } },
        },
      },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: RESULTS_LIMIT,
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          scorePercent: true,
          passed: true,
          startedAt: true,
          submittedAt: true,
          enrollment: { select: { user: { select: { name: true, email: true } } } },
        },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!assessment) return null;

  return {
    id: assessment.id,
    title: assessment.title,
    kind: assessment.kind,
    status: assessment.status,
    timeLimitMins: assessment.timeLimitMins,
    passingScorePercent: assessment.passingScorePercent,
    allowedAttempts: assessment.allowedAttempts,
    shuffleQuestions: assessment.shuffleQuestions,
    showResultsImmediately: assessment.showResultsImmediately,
    module: { id: assessment.module.id, order: assessment.module.order, title: assessment.module.title },
    program: assessment.module.program,
    lesson: assessment.lesson,
    questions: assessment.questions,
    totalMarks: assessment.questions.reduce((sum, question) => sum + question.points, 0),
    autoGradedMarks: assessment.questions
      .filter((question) => question.type !== "CODE_SNIPPET")
      .reduce((sum, question) => sum + question.points, 0),
    attemptCount: assessment._count.attempts,
    attempts: assessment.attempts.map((attempt) => ({
      id: attempt.id,
      learnerName: attempt.enrollment.user.name,
      learnerEmail: attempt.enrollment.user.email,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    })),
  };
}
