import "server-only";
import type { AttemptStatus, QuestionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seededShuffle } from "@/lib/shuffle";

/** Cheap lookup used by guards to resolve which program an assessment
 * belongs to, before requireGrantedEnrollment can run. Mirrors
 * resolveLessonProgram in queries/lessons.ts. */
export async function resolveAssessmentProgram(
  assessmentId: string,
): Promise<{ programId: string; moduleId: string } | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { moduleId: true, module: { select: { programId: true } } },
  });
  if (!assessment) return null;
  return { programId: assessment.module.programId, moduleId: assessment.moduleId };
}

export type AssessmentOverview = {
  id: string;
  title: string;
  timeLimitMins: number | null;
  passingScorePercent: number | null;
  allowedAttempts: number;
  questionCount: number;
  finishedAttemptCount: number;
  inProgressAttemptId: string | null;
};

/** Powers the pre-attempt page: one query (assessment + this enrollment's
 * attempts + a question count), no N+1. */
export async function getAssessmentOverview(
  assessmentId: string,
  enrollmentId: string,
): Promise<AssessmentOverview | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      timeLimitMins: true,
      passingScorePercent: true,
      allowedAttempts: true,
      _count: { select: { questions: true } },
      attempts: {
        where: { enrollmentId },
        select: { id: true, status: true },
      },
    },
  });
  if (!assessment) return null;

  const finishedAttemptCount = assessment.attempts.filter(
    (attempt) => attempt.status === "SUBMITTED" || attempt.status === "GRADED",
  ).length;
  const inProgress = assessment.attempts.find((attempt) => attempt.status === "IN_PROGRESS");

  return {
    id: assessment.id,
    title: assessment.title,
    timeLimitMins: assessment.timeLimitMins,
    passingScorePercent: assessment.passingScorePercent,
    allowedAttempts: assessment.allowedAttempts,
    questionCount: assessment._count.questions,
    finishedAttemptCount,
    inProgressAttemptId: inProgress?.id ?? null,
  };
}

export type AttemptGuardInfo = {
  id: string;
  enrollmentId: string;
  status: AttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  scorePercent: number | null;
  passed: boolean | null;
  assessmentId: string;
  moduleId: string;
  programId: string;
  title: string;
  timeLimitMins: number | null;
  allowedAttempts: number;
  shuffleQuestions: boolean;
  showResultsImmediately: boolean;
  passingScorePercent: number | null;
};

/** One query used by every attempt-scoped action/page to decide
 * ownership, expiry, and which view to render. */
export async function getAttemptForGuard(attemptId: string): Promise<AttemptGuardInfo | null> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      enrollmentId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      scorePercent: true,
      passed: true,
      assessmentId: true,
      assessment: {
        select: {
          title: true,
          timeLimitMins: true,
          allowedAttempts: true,
          shuffleQuestions: true,
          showResultsImmediately: true,
          passingScorePercent: true,
          moduleId: true,
          module: { select: { programId: true } },
        },
      },
    },
  });
  if (!attempt) return null;

  return {
    id: attempt.id,
    enrollmentId: attempt.enrollmentId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    assessmentId: attempt.assessmentId,
    moduleId: attempt.assessment.moduleId,
    programId: attempt.assessment.module.programId,
    title: attempt.assessment.title,
    timeLimitMins: attempt.assessment.timeLimitMins,
    allowedAttempts: attempt.assessment.allowedAttempts,
    shuffleQuestions: attempt.assessment.shuffleQuestions,
    showResultsImmediately: attempt.assessment.showResultsImmediately,
    passingScorePercent: attempt.assessment.passingScorePercent,
  };
}

export type LiveAttemptOption = { id: string; label: string; text: string };

export type LiveAttemptQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  text: string;
  points: number;
  options: LiveAttemptOption[];
  selectedOptionId: string | null;
  freeTextAnswer: string | null;
  flagged: boolean;
};

/** Questions for an IN_PROGRESS attempt. isCorrect/explanation are never
 * selected from the DB here (not merely hidden client-side) — an in-progress
 * attempt's payload cannot leak answers before grading. */
export async function getLiveAttemptQuestions(
  assessmentId: string,
  attemptId: string,
  shuffle: boolean,
): Promise<LiveAttemptQuestion[]> {
  const questions = await prisma.question.findMany({
    where: { assessmentId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      type: true,
      text: true,
      points: true,
      options: {
        orderBy: { label: "asc" },
        select: { id: true, label: true, text: true },
      },
      answers: {
        where: { attemptId },
        select: { selectedOptionId: true, freeTextAnswer: true, flagged: true },
        take: 1,
      },
    },
  });

  const ordered = shuffle ? seededShuffle(questions, attemptId) : questions;

  return ordered.map((question) => {
    const answer = question.answers[0];
    return {
      id: question.id,
      order: question.order,
      type: question.type,
      text: question.text,
      points: question.points,
      options: question.options,
      selectedOptionId: answer?.selectedOptionId ?? null,
      freeTextAnswer: answer?.freeTextAnswer ?? null,
      flagged: answer?.flagged ?? false,
    };
  });
}

export type GradedAttemptOption = LiveAttemptOption & { isCorrect: boolean };

export type GradedAttemptQuestion = Omit<LiveAttemptQuestion, "options"> & {
  options: GradedAttemptOption[];
  explanation: string | null;
};

/** Questions + correctness for a SUBMITTED/GRADED attempt, shown only when
 * showResultsImmediately is true (callers decide whether to invoke this). */
export async function getGradedAttemptQuestions(
  assessmentId: string,
  attemptId: string,
  shuffle: boolean,
): Promise<GradedAttemptQuestion[]> {
  const questions = await prisma.question.findMany({
    where: { assessmentId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      type: true,
      text: true,
      points: true,
      explanation: true,
      options: {
        orderBy: { label: "asc" },
        select: { id: true, label: true, text: true, isCorrect: true },
      },
      answers: {
        where: { attemptId },
        select: { selectedOptionId: true, freeTextAnswer: true, flagged: true },
        take: 1,
      },
    },
  });

  const ordered = shuffle ? seededShuffle(questions, attemptId) : questions;

  return ordered.map((question) => {
    const answer = question.answers[0];
    return {
      id: question.id,
      order: question.order,
      type: question.type,
      text: question.text,
      points: question.points,
      explanation: question.explanation,
      options: question.options,
      selectedOptionId: answer?.selectedOptionId ?? null,
      freeTextAnswer: answer?.freeTextAnswer ?? null,
      flagged: answer?.flagged ?? false,
    };
  });
}
