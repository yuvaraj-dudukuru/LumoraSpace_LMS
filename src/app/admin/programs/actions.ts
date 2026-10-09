"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { firstIssue, formObject, programOutcomeSchema, programSchema } from "@/lib/validations/admin-content";

function revalidatePrograms(programId?: string, slug?: string): void {
  revalidatePath("/admin/programs");
  if (programId) revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin");
  revalidatePath("/programs", "layout");
  if (slug) revalidatePath(`/programs/${slug}`);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** A new program is always DRAFT — it has no curriculum yet, and publishing
 * is its own deliberate step (setProgramStatus on the detail page). */
export async function createProgram(formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = programSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const fields = parsed.data;

  try {
    const program = await prisma.program.create({
      data: {
        name: fields.name,
        slug: fields.slug,
        description: fields.description,
        level: fields.level,
        durationWeeks: fields.durationWeeks,
        format: fields.format,
        credentialType: fields.credentialType ?? null,
        price: fields.price ?? null,
      },
      select: { id: true },
    });
    revalidatePrograms(program.id);
    return { ok: true, redirectTo: `/admin/programs/${program.id}` };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `The slug "${fields.slug}" is already used by another program.` };
    throw error;
  }
}

/** Status is not editable here (setProgramStatus owns it). Changing the slug
 * of a PUBLISHED program moves its public URL — both old and new paths are
 * revalidated so the old one stops serving. */
export async function updateProgram(programId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = programSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const fields = parsed.data;

  const existing = await prisma.program.findUnique({ where: { id: programId }, select: { slug: true } });
  if (!existing) return { ok: false, error: "Program not found." };

  try {
    await prisma.program.update({
      where: { id: programId },
      data: {
        name: fields.name,
        slug: fields.slug,
        description: fields.description,
        level: fields.level,
        durationWeeks: fields.durationWeeks,
        format: fields.format,
        credentialType: fields.credentialType ?? null,
        price: fields.price ?? null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `The slug "${fields.slug}" is already used by another program.` };
    throw error;
  }

  revalidatePrograms(programId, existing.slug);
  revalidatePath(`/programs/${fields.slug}`);
  return { ok: true };
}

const MAX_OUTCOMES = 12;

/** "What you'll learn" tiles on the public program page. Appended at the end. */
export async function addProgramOutcome(programId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = programOutcomeSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { slug: true, outcomes: { orderBy: { order: "desc" }, take: 1, select: { order: true } }, _count: { select: { outcomes: true } } },
  });
  if (!program) return { ok: false, error: "Program not found." };
  if (program._count.outcomes >= MAX_OUTCOMES) return { ok: false, error: `A program can list at most ${MAX_OUTCOMES} outcomes.` };

  await prisma.programOutcome.create({
    data: {
      programId,
      title: parsed.data.title,
      description: parsed.data.description,
      icon: "sparkles", // ProgramOutcome.icon is required; no page renders it yet
      order: (program.outcomes[0]?.order ?? 0) + 1,
    },
  });

  revalidatePrograms(programId, program.slug);
  return { ok: true };
}

export async function deleteProgramOutcome(programId: string, outcomeId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const outcome = await prisma.programOutcome.findUnique({
    where: { id: outcomeId },
    select: { programId: true, program: { select: { slug: true } } },
  });
  if (!outcome || outcome.programId !== programId) return { ok: false, error: "Outcome not found." };

  await prisma.programOutcome.delete({ where: { id: outcomeId } });
  revalidatePrograms(programId, outcome.program.slug);
  return { ok: true };
}
