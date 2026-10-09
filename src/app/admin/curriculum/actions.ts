"use server";

import { revalidatePath } from "next/cache";
import type { ContentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { recalculateProgramProgress } from "@/lib/progress-rollup";
import { firstIssue, formObject, lessonSchema, moduleSchema } from "@/lib/validations/admin-content";

/** Every curriculum write ends here: the builder, the admin program pages,
 * and every learner page that draws the curriculum tree. `touch` bumps
 * Program.updatedAt (modules/lessons have no timestamp of their own), which
 * is the builder's "Last Updated". */
async function afterCurriculumChange(programId: string, options: { recalculate: boolean }): Promise<void> {
  await prisma.program.update({ where: { id: programId }, data: { updatedAt: new Date() } });
  // Only when what a learner must complete actually changed.
  if (options.recalculate) await recalculateProgramProgress(programId);
  revalidatePath("/admin/curriculum");
  revalidatePath("/admin/programs", "layout");
  revalidatePath("/admin/assessments", "layout");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin");
  revalidatePath("/learn", "layout");
  revalidatePath("/programs", "layout");
}

// ── Modules ─────────────────────────────────────────────────────────

/** Appended after the last module, as DRAFT — learners only ever see
 * PUBLISHED modules (getProgramProgress), so a new one is invisible until
 * an admin publishes it. */
export async function createModule(programId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = moduleSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { status: true, modules: { orderBy: { order: "desc" }, take: 1, select: { order: true } } },
  });
  if (!program) return { ok: false, error: "Program not found." };
  if (program.status === "ARCHIVED") return { ok: false, error: "An archived program can't be edited." };

  await prisma.module.create({
    data: {
      programId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      estimatedDurationMins: parsed.data.estimatedDurationMins ?? null,
      order: (program.modules[0]?.order ?? 0) + 1,
      status: "DRAFT",
    },
  });

  await afterCurriculumChange(programId, { recalculate: false });
  return { ok: true };
}

export async function updateModule(moduleId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = moduleSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const existing = await prisma.module.findUnique({ where: { id: moduleId }, select: { programId: true } });
  if (!existing) return { ok: false, error: "Module not found." };

  await prisma.module.update({
    where: { id: moduleId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      estimatedDurationMins: parsed.data.estimatedDurationMins ?? null,
    },
  });

  await afterCurriculumChange(existing.programId, { recalculate: false });
  return { ok: true };
}

/** Publish / unpublish. Changes what learners must complete, so every live
 * enrollment's cached percentage is recalculated (no certificates issued —
 * see recalculateProgramProgress). */
export async function setModuleStatus(moduleId: string, status: ContentStatus): Promise<ActionResult> {
  await requireRole("ADMIN");
  if (status !== "PUBLISHED" && status !== "DRAFT") return { ok: false, error: "Choose Published or Draft." };

  const existing = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { programId: true, status: true, _count: { select: { lessons: true } } },
  });
  if (!existing) return { ok: false, error: "Module not found." };
  if (existing.status === status) return { ok: true }; // idempotent
  if (status === "PUBLISHED" && existing._count.lessons === 0) {
    return { ok: false, error: "Add at least one lesson before publishing this module." };
  }

  await prisma.module.update({ where: { id: moduleId }, data: { status } });
  await afterCurriculumChange(existing.programId, { recalculate: true });
  return { ok: true };
}

/** Refused once any learner work hangs off the module — deleting would
 * cascade away their lesson progress, attempts and submissions. Unpublish
 * it instead. */
export async function deleteModule(moduleId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      programId: true,
      lessons: { select: { _count: { select: { progress: true } } } },
      assessments: { select: { _count: { select: { attempts: true } } } },
      assignments: { select: { _count: { select: { submissions: true } } } },
    },
  });
  if (!existing) return { ok: false, error: "Module not found." };

  const learnerRows =
    existing.lessons.reduce((sum, lesson) => sum + lesson._count.progress, 0) +
    existing.assessments.reduce((sum, assessment) => sum + assessment._count.attempts, 0) +
    existing.assignments.reduce((sum, assignment) => sum + assignment._count.submissions, 0);
  if (learnerRows > 0) {
    return { ok: false, error: "Learners already have progress in this module. Unpublish it instead of deleting it." };
  }

  await prisma.module.delete({ where: { id: moduleId } });
  await afterCurriculumChange(existing.programId, { recalculate: true });
  return { ok: true };
}

/** Swaps `order` with the neighbouring module in that direction. Orders need
 * not be contiguous (deleting leaves gaps), so it swaps values, not ±1. */
export async function moveModule(moduleId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireRole("ADMIN");

  const current = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true, order: true, programId: true } });
  if (!current) return { ok: false, error: "Module not found." };

  const neighbour = await prisma.module.findFirst({
    where: { programId: current.programId, order: direction === "up" ? { lt: current.order } : { gt: current.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return { ok: true }; // already first/last

  await prisma.$transaction([
    prisma.module.update({ where: { id: current.id }, data: { order: neighbour.order } }),
    prisma.module.update({ where: { id: neighbour.id }, data: { order: current.order } }),
  ]);

  await afterCurriculumChange(current.programId, { recalculate: false });
  return { ok: true };
}

// ── Lessons ─────────────────────────────────────────────────────────

/** The assessment a QUIZ lesson may link to: in the same module, and not
 * already attached to a different lesson (Lesson.assessmentId is unique). */
async function resolveLessonAssessment(
  type: string,
  assessmentId: string | undefined,
  moduleId: string,
  lessonId: string | null,
): Promise<{ ok: true; assessmentId: string | null } | { ok: false; error: string }> {
  if (type !== "QUIZ" || !assessmentId) return { ok: true, assessmentId: null };

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { moduleId: true, lesson: { select: { id: true } } },
  });
  if (!assessment || assessment.moduleId !== moduleId) {
    return { ok: false, error: "Choose an assessment from this module." };
  }
  if (assessment.lesson && assessment.lesson.id !== lessonId) {
    return { ok: false, error: "That assessment is already linked to another lesson." };
  }
  return { ok: true, assessmentId };
}

export async function createLesson(moduleId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = lessonSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const fields = parsed.data;

  const programModule = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { programId: true, status: true, lessons: { orderBy: { order: "desc" }, take: 1, select: { order: true } } },
  });
  if (!programModule) return { ok: false, error: "Module not found." };

  const assessment = await resolveLessonAssessment(fields.type, fields.assessmentId, moduleId, null);
  if (!assessment.ok) return assessment;

  await prisma.lesson.create({
    data: {
      moduleId,
      title: fields.title,
      type: fields.type,
      order: (programModule.lessons[0]?.order ?? 0) + 1,
      durationMins: fields.durationMins ?? null,
      description: fields.description ?? null,
      videoUrl: fields.videoUrl ?? null,
      bodyContent: fields.bodyContent ?? null,
      assessmentId: assessment.assessmentId,
    },
  });

  // A lesson added to a published module is new required work for everyone in it.
  await afterCurriculumChange(programModule.programId, { recalculate: programModule.status === "PUBLISHED" });
  return { ok: true };
}

export async function updateLesson(lessonId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = lessonSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const fields = parsed.data;

  const existing = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { moduleId: true, module: { select: { programId: true } } },
  });
  if (!existing) return { ok: false, error: "Lesson not found." };

  const assessment = await resolveLessonAssessment(fields.type, fields.assessmentId, existing.moduleId, lessonId);
  if (!assessment.ok) return assessment;

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: fields.title,
      type: fields.type,
      durationMins: fields.durationMins ?? null,
      description: fields.description ?? null,
      videoUrl: fields.videoUrl ?? null,
      bodyContent: fields.bodyContent ?? null,
      assessmentId: assessment.assessmentId,
    },
  });

  await afterCurriculumChange(existing.module.programId, { recalculate: false });
  return { ok: true };
}

/** Refused once any learner has a LessonProgress row for it (completion or
 * saved notes) — deleting would erase that. */
export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const existing = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { programId: true, status: true } }, _count: { select: { progress: true } } },
  });
  if (!existing) return { ok: false, error: "Lesson not found." };
  if (existing._count.progress > 0) {
    return { ok: false, error: "Learners already have progress or notes on this lesson, so it can't be deleted." };
  }

  await prisma.lesson.delete({ where: { id: lessonId } });
  await afterCurriculumChange(existing.module.programId, { recalculate: existing.module.status === "PUBLISHED" });
  return { ok: true };
}

export async function moveLesson(lessonId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireRole("ADMIN");

  const current = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, order: true, moduleId: true, module: { select: { programId: true } } },
  });
  if (!current) return { ok: false, error: "Lesson not found." };

  const neighbour = await prisma.lesson.findFirst({
    where: { moduleId: current.moduleId, order: direction === "up" ? { lt: current.order } : { gt: current.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return { ok: true };

  await prisma.$transaction([
    prisma.lesson.update({ where: { id: current.id }, data: { order: neighbour.order } }),
    prisma.lesson.update({ where: { id: neighbour.id }, data: { order: current.order } }),
  ]);

  await afterCurriculumChange(current.module.programId, { recalculate: false });
  return { ok: true };
}
