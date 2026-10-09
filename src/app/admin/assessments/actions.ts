"use server";

import { revalidatePath } from "next/cache";
import type { ContentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  assessmentSettingsSchema,
  assessmentStatusSchema,
  createAssessmentSchema,
  firstIssue,
  formObject,
  parseQuestionForm,
  type QuestionInput,
} from "@/lib/validations/admin-content";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function revalidateAssessments(assessmentId?: string): void {
  revalidatePath("/admin/assessments");
  if (assessmentId) revalidatePath(`/admin/assessments/${assessmentId}`);
  revalidatePath("/admin/curriculum");
  revalidatePath("/admin/programs", "layout");
  revalidatePath("/learn", "layout");
}

/** The question bank is frozen once ANY attempt exists: Answer rows point at
 * these questions and options, and an attempt's score was computed from
 * them — editing would silently change what a learner was graded on.
 * Settings and status stay editable; "Duplicate" makes an editable copy. */
async function assertBankEditable(assessmentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const attempts = await prisma.attempt.count({ where: { assessmentId } });
  if (attempts > 0) {
    return {
      ok: false,
      error: "Learners have already attempted this assessment, so its questions are locked. Duplicate it to make changes.",
    };
  }
  return { ok: true };
}

function optionRows(question: QuestionInput): { label: string; text: string; isCorrect: boolean }[] {
  return question.optionTexts.map((optionText, index) => ({
    label: OPTION_LABELS[index] ?? String(index + 1),
    text: optionText,
    isCorrect: index === question.correctIndex,
  }));
}

export async function createAssessment(formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = createAssessmentSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const programModule = await prisma.module.findUnique({
    where: { id: parsed.data.moduleId },
    select: { program: { select: { status: true } } },
  });
  if (!programModule) return { ok: false, error: "Module not found." };
  if (programModule.program.status === "ARCHIVED") return { ok: false, error: "An archived program can't take new content." };

  const assessment = await prisma.assessment.create({
    // PRACTICE: unlimited attempts, no threshold. GRADED: one attempt, 70% to pass. Both editable in Settings.
    data: {
      moduleId: parsed.data.moduleId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      status: "DRAFT",
      allowedAttempts: parsed.data.kind === "PRACTICE" ? 0 : 1,
      passingScorePercent: parsed.data.kind === "GRADED" ? 70 : null,
    },
    select: { id: true },
  });

  revalidateAssessments(assessment.id);
  return { ok: true, redirectTo: `/admin/assessments/${assessment.id}` };
}

export async function updateAssessmentSettings(assessmentId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = assessmentSettingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const existing = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } });
  if (!existing) return { ok: false, error: "Assessment not found." };

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      title: parsed.data.title,
      kind: parsed.data.kind,
      timeLimitMins: parsed.data.timeLimitMins ?? null,
      passingScorePercent: parsed.data.passingScorePercent ?? null,
      allowedAttempts: parsed.data.allowedAttempts,
      shuffleQuestions: parsed.data.shuffleQuestions,
      showResultsImmediately: parsed.data.showResultsImmediately,
    },
  });

  revalidateAssessments(assessmentId);
  return { ok: true };
}

/** Publishing needs something a learner can actually take: at least one
 * question (the schema already guarantees every choice question has a
 * correct option — see questionSchema). */
export async function setAssessmentStatus(assessmentId: string, status: ContentStatus): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = assessmentStatusSchema.safeParse({ status });
  if (!parsed.success) return { ok: false, error: "Choose a valid status." };

  const existing = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { status: true, _count: { select: { questions: true } } },
  });
  if (!existing) return { ok: false, error: "Assessment not found." };
  if (existing.status === parsed.data.status) return { ok: true }; // idempotent
  if (parsed.data.status === "PUBLISHED" && existing._count.questions === 0) {
    return { ok: false, error: "Add at least one question before publishing." };
  }

  await prisma.assessment.update({ where: { id: assessmentId }, data: { status: parsed.data.status } });
  revalidateAssessments(assessmentId);
  return { ok: true };
}

/** Only an assessment nobody has attempted — otherwise archive it. A linked
 * quiz lesson is left in place with its link cleared (the curriculum
 * validation panel then flags it). */
export async function deleteAssessment(assessmentId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { _count: { select: { attempts: true } } },
  });
  if (!existing) return { ok: false, error: "Assessment not found." };
  if (existing._count.attempts > 0) {
    return { ok: false, error: "This assessment has attempts and can't be deleted. Archive it instead." };
  }

  await prisma.$transaction([
    prisma.lesson.updateMany({ where: { assessmentId }, data: { assessmentId: null } }),
    prisma.assessment.delete({ where: { id: assessmentId } }),
  ]);

  revalidateAssessments();
  return { ok: true, redirectTo: "/admin/assessments" };
}

/** An editable DRAFT copy in the same module — the way to change a question
 * bank that attempts have locked. Not linked to any lesson. */
export async function duplicateAssessment(assessmentId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const source = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { label: "asc" } } } } },
  });
  if (!source) return { ok: false, error: "Assessment not found." };

  const copy = await prisma.assessment.create({
    data: {
      moduleId: source.moduleId,
      title: `${source.title} (copy)`.slice(0, 160),
      kind: source.kind,
      status: "DRAFT",
      timeLimitMins: source.timeLimitMins,
      passingScorePercent: source.passingScorePercent,
      allowedAttempts: source.allowedAttempts,
      shuffleQuestions: source.shuffleQuestions,
      showResultsImmediately: source.showResultsImmediately,
      questions: {
        create: source.questions.map((question) => ({
          order: question.order,
          type: question.type,
          text: question.text,
          points: question.points,
          explanation: question.explanation,
          options: {
            create: question.options.map((option) => ({ label: option.label, text: option.text, isCorrect: option.isCorrect })),
          },
        })),
      },
    },
    select: { id: true },
  });

  revalidateAssessments(copy.id);
  return { ok: true, redirectTo: `/admin/assessments/${copy.id}` };
}

// ── Questions ───────────────────────────────────────────────────────

export async function addQuestion(assessmentId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseQuestionForm(formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const existing = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { questions: { orderBy: { order: "desc" }, take: 1, select: { order: true } } },
  });
  if (!existing) return { ok: false, error: "Assessment not found." };
  const editable = await assertBankEditable(assessmentId);
  if (!editable.ok) return editable;

  await prisma.question.create({
    data: {
      assessmentId,
      order: (existing.questions[0]?.order ?? 0) + 1,
      type: parsed.data.type,
      text: parsed.data.text,
      points: parsed.data.points,
      explanation: parsed.data.explanation ?? null,
      options: { create: optionRows(parsed.data) },
    },
  });
  await prisma.assessment.update({ where: { id: assessmentId }, data: { updatedAt: new Date() } });

  revalidateAssessments(assessmentId);
  return { ok: true };
}

/** Options are replaced wholesale — safe because the bank is only editable
 * while no Answer row can reference them. */
export async function updateQuestion(questionId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseQuestionForm(formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const existing = await prisma.question.findUnique({ where: { id: questionId }, select: { assessmentId: true } });
  if (!existing) return { ok: false, error: "Question not found." };
  const editable = await assertBankEditable(existing.assessmentId);
  if (!editable.ok) return editable;

  await prisma.$transaction([
    prisma.questionOption.deleteMany({ where: { questionId } }),
    prisma.question.update({
      where: { id: questionId },
      data: {
        type: parsed.data.type,
        text: parsed.data.text,
        points: parsed.data.points,
        explanation: parsed.data.explanation ?? null,
        options: { create: optionRows(parsed.data) },
      },
    }),
    prisma.assessment.update({ where: { id: existing.assessmentId }, data: { updatedAt: new Date() } }),
  ]);

  revalidateAssessments(existing.assessmentId);
  return { ok: true };
}

export async function deleteQuestion(questionId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await prisma.question.findUnique({ where: { id: questionId }, select: { assessmentId: true } });
  if (!existing) return { ok: false, error: "Question not found." };
  const editable = await assertBankEditable(existing.assessmentId);
  if (!editable.ok) return editable;

  await prisma.question.delete({ where: { id: questionId } });
  await prisma.assessment.update({ where: { id: existing.assessmentId }, data: { updatedAt: new Date() } });

  revalidateAssessments(existing.assessmentId);
  return { ok: true };
}

/** A copy placed at the end of the bank. */
export async function duplicateQuestion(questionId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const source = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { label: "asc" } } },
  });
  if (!source) return { ok: false, error: "Question not found." };
  const editable = await assertBankEditable(source.assessmentId);
  if (!editable.ok) return editable;

  const last = await prisma.question.findFirst({
    where: { assessmentId: source.assessmentId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.question.create({
    data: {
      assessmentId: source.assessmentId,
      order: (last?.order ?? 0) + 1,
      type: source.type,
      text: source.text,
      points: source.points,
      explanation: source.explanation,
      options: { create: source.options.map((option) => ({ label: option.label, text: option.text, isCorrect: option.isCorrect })) },
    },
  });
  await prisma.assessment.update({ where: { id: source.assessmentId }, data: { updatedAt: new Date() } });

  revalidateAssessments(source.assessmentId);
  return { ok: true };
}

export async function moveQuestion(questionId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireRole("ADMIN");

  const current = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, order: true, assessmentId: true } });
  if (!current) return { ok: false, error: "Question not found." };
  const editable = await assertBankEditable(current.assessmentId);
  if (!editable.ok) return editable;

  const neighbour = await prisma.question.findFirst({
    where: { assessmentId: current.assessmentId, order: direction === "up" ? { lt: current.order } : { gt: current.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return { ok: true };

  await prisma.$transaction([
    prisma.question.update({ where: { id: current.id }, data: { order: neighbour.order } }),
    prisma.question.update({ where: { id: neighbour.id }, data: { order: current.order } }),
  ]);

  revalidateAssessments(current.assessmentId);
  return { ok: true };
}
