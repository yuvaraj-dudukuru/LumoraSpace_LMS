"use server";

import { revalidatePath } from "next/cache";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { getAttemptForGuard, type AttemptGuardInfo } from "@/lib/queries/assessments";
import { saveAnswerSchema } from "@/lib/validations/assessment";
import { refreshEnrollmentProgress } from "@/lib/progress-rollup";
import { prisma } from "@/lib/prisma";

type AuthorizedAttempt = { ok: true; attempt: AttemptGuardInfo } | { ok: false; error: string };

/** attemptId is attacker-controlled — every action re-resolves it to its
 * assessment/module/program and re-verifies a granted enrollment AND that the
 * attempt belongs to the caller, never trusting that the calling page (or a
 * previous call) already checked. */
async function authorizeAttempt(attemptId: string): Promise<AuthorizedAttempt> {
  const attempt = await getAttemptForGuard(attemptId);
  if (!attempt) return { ok: false, error: "Attempt not found." };

  const enrollment = await requireGrantedEnrollment(attempt.programId);
  if (attempt.enrollmentId !== enrollment.id) {
    return { ok: false, error: "This attempt does not belong to you." };
  }
  return { ok: true, attempt };
}

export type SaveAnswerResult = { ok: true } | { ok: false; error: string };

/** Fires on every answer change, not just on submit. Verifies the attempt
 * belongs to the caller AND is still IN_PROGRESS, and that questionId/
 * selectedOptionId actually belong to this attempt's assessment/question. */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  answer: { selectedOptionId?: string; freeTextAnswer?: string },
): Promise<SaveAnswerResult> {
  const auth = await authorizeAttempt(attemptId);
  if (!auth.ok) return auth;
  if (auth.attempt.status !== "IN_PROGRESS") {
    return { ok: false, error: "This attempt is no longer in progress." };
  }

  const parsed = saveAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answer." };
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { assessmentId: true, options: { select: { id: true } } },
  });
  if (!question || question.assessmentId !== auth.attempt.assessmentId) {
    return { ok: false, error: "Question not found for this attempt." };
  }
  if (
    parsed.data.selectedOptionId &&
    !question.options.some((option) => option.id === parsed.data.selectedOptionId)
  ) {
    return { ok: false, error: "Invalid option for this question." };
  }

  await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: {
      attemptId,
      questionId,
      selectedOptionId: parsed.data.selectedOptionId,
      freeTextAnswer: parsed.data.freeTextAnswer,
    },
    update: {
      selectedOptionId: parsed.data.selectedOptionId ?? null,
      freeTextAnswer: parsed.data.freeTextAnswer ?? null,
    },
  });

  return { ok: true };
}

export type ToggleFlagResult = { ok: true; flagged: boolean } | { ok: false; error: string };

export async function toggleFlag(attemptId: string, questionId: string): Promise<ToggleFlagResult> {
  const auth = await authorizeAttempt(attemptId);
  if (!auth.ok) return auth;
  if (auth.attempt.status !== "IN_PROGRESS") {
    return { ok: false, error: "This attempt is no longer in progress." };
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { assessmentId: true },
  });
  if (!question || question.assessmentId !== auth.attempt.assessmentId) {
    return { ok: false, error: "Question not found for this attempt." };
  }

  const existing = await prisma.answer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    select: { flagged: true },
  });
  const nextFlagged = existing ? !existing.flagged : true;

  await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, flagged: nextFlagged },
    update: { flagged: nextFlagged },
  });

  return { ok: true, flagged: nextFlagged };
}

export type SubmitAttemptResult =
  | { ok: true; scorePercent: number | null; passed: boolean | null }
  | { ok: false; error: string };

/** TIMER IS SERVER-AUTHORITATIVE: this grades whatever was saved regardless
 * of why it was called — an explicit learner click, or the attempt page
 * detecting on load that startedAt + timeLimitMins has already passed. The
 * client's countdown is cosmetic only; this function never accepts a
 * caller-supplied remaining-time value. */
export async function submitAttempt(attemptId: string): Promise<SubmitAttemptResult> {
  const auth = await authorizeAttempt(attemptId);
  if (!auth.ok) return auth;

  if (auth.attempt.status !== "IN_PROGRESS") {
    return { ok: true, scorePercent: auth.attempt.scorePercent, passed: auth.attempt.passed };
  }

  const result = await gradeAttempt(attemptId, auth.attempt.assessmentId, auth.attempt.passingScorePercent);
  revalidatePath(`/learn/attempts/${attemptId}`);

  if (auth.attempt.lessonId) {
    await markQuizLessonIfComplete({
      lessonId: auth.attempt.lessonId,
      enrollmentId: auth.attempt.enrollmentId,
      programId: auth.attempt.programId,
      passingScorePercent: auth.attempt.passingScorePercent,
      passed: result.passed,
    });
  }

  return result;
}

/** A QUIZ lesson completes automatically on a passing attempt — or on ANY
 * submission when the assessment has no passingScorePercent at all. A
 * failed attempt (a threshold exists and wasn't met) does nothing: no
 * upsert, and — deliberately — no un-marking a lesson a learner already
 * completed on an earlier attempt. The spec doesn't address a later failed
 * retake after an earlier pass; revoking felt like the more surprising
 * choice, so completion here is monotonic. Reuses refreshEnrollmentProgress
 * — the exact rollup markLessonComplete uses — rather than recomputing it. */
async function markQuizLessonIfComplete({
  lessonId,
  enrollmentId,
  programId,
  passingScorePercent,
  passed,
}: {
  lessonId: string;
  enrollmentId: string;
  programId: string;
  passingScorePercent: number | null;
  passed: boolean | null;
}): Promise<void> {
  const isComplete = passingScorePercent === null || passed === true;
  if (!isComplete) return;

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    create: { enrollmentId, lessonId, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  });

  await refreshEnrollmentProgress(enrollmentId);

  revalidatePath(`/learn/lessons/${lessonId}`);
  revalidatePath(`/learn/programs/${programId}`);
  revalidatePath("/learn");
  revalidatePath("/learn/my-learning");
  revalidatePath("/learn/progress");
}

/** Auto-grades MULTIPLE_CHOICE/TRUE_FALSE (points-weighted) against
 * QuestionOption.isCorrect. CODE_SNIPPET questions cannot be auto-graded:
 * their freeTextAnswer stays stored (already saved via saveAnswer) but is
 * excluded from both the points total and the score — a future manual-
 * grading feature would read Answer.freeTextAnswer on GRADED attempts for
 * CODE_SNIPPET questions; nothing further is built here since that's out of
 * this milestone's scope. scorePercent/passed are null when there are no
 * auto-gradable questions at all (nothing to score yet). */
async function gradeAttempt(
  attemptId: string,
  assessmentId: string,
  passingScorePercent: number | null,
): Promise<{ ok: true; scorePercent: number | null; passed: boolean | null }> {
  const questions = await prisma.question.findMany({
    where: { assessmentId },
    select: {
      type: true,
      points: true,
      options: { select: { id: true, isCorrect: true } },
      answers: { where: { attemptId }, select: { selectedOptionId: true }, take: 1 },
    },
  });

  let earnedPoints = 0;
  let gradablePoints = 0;

  for (const question of questions) {
    if (question.type === "CODE_SNIPPET") continue;
    gradablePoints += question.points;

    const selectedOptionId = question.answers[0]?.selectedOptionId;
    if (!selectedOptionId) continue;

    const chosen = question.options.find((option) => option.id === selectedOptionId);
    if (chosen?.isCorrect) earnedPoints += question.points;
  }

  const scorePercent = gradablePoints === 0 ? null : Math.round((earnedPoints / gradablePoints) * 1000) / 10;
  const passed =
    passingScorePercent === null || scorePercent === null ? null : scorePercent >= passingScorePercent;

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "GRADED", scorePercent, passed, submittedAt: new Date() },
  });

  return { ok: true, scorePercent, passed };
}
