"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { BatchStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  batchMentorSchema,
  batchSchema,
  batchStatusSchema,
  firstIssue,
  formObject,
} from "@/lib/validations/admin-content";
import { assignMentorToBatch, removeMentorFromBatch } from "@/app/admin/users/actions";

function revalidateBatches(batchId?: string): void {
  revalidatePath("/admin/batches");
  if (batchId) revalidatePath(`/admin/batches/${batchId}`);
  revalidatePath("/admin/mentors");
  revalidatePath("/admin/programs");
  revalidatePath("/admin");
  revalidatePath("/programs", "layout"); // the public enroll form lists open batches
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createBatch(formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = batchSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { programId, ...fields } = parsed.data;

  const program = await prisma.program.findUnique({ where: { id: programId }, select: { status: true } });
  if (!program) return { ok: false, error: "Program not found." };
  if (program.status === "ARCHIVED") return { ok: false, error: "An archived program can't take a new batch." };

  try {
    const batch = await prisma.batch.create({
      data: {
        programId,
        name: fields.name,
        code: fields.code,
        startDate: fields.startDate,
        endDate: fields.endDate,
        scheduleNote: fields.scheduleNote ?? null,
        capacity: fields.capacity ?? null,
      },
      select: { id: true },
    });
    revalidateBatches(batch.id);
    return { ok: true, redirectTo: `/admin/batches/${batch.id}` };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Batch code "${fields.code}" is already in use.` };
    throw error;
  }
}

/** The program is fixed once a batch exists: Enrollment and Certificate rows
 * carry their own programId, so moving a batch would leave them pointing at
 * the old program. The form posts the current id and this rejects any other. */
export async function updateBatch(batchId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = batchSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const fields = parsed.data;

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      programId: true,
      _count: { select: { enrollments: { where: { status: { notIn: ["CANCELLED", "DROPPED"] } } } } },
    },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  if (fields.programId !== batch.programId) return { ok: false, error: "A batch can't be moved to another program." };
  if (fields.capacity !== undefined && fields.capacity < batch._count.enrollments) {
    return {
      ok: false,
      error: `Capacity can't be below the ${batch._count.enrollments} learner${batch._count.enrollments === 1 ? "" : "s"} already enrolled.`,
    };
  }

  try {
    await prisma.batch.update({
      where: { id: batchId },
      data: {
        name: fields.name,
        code: fields.code,
        startDate: fields.startDate,
        endDate: fields.endDate,
        scheduleNote: fields.scheduleNote ?? null,
        capacity: fields.capacity ?? null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Batch code "${fields.code}" is already in use.` };
    throw error;
  }

  revalidateBatches(batchId);
  return { ok: true };
}

/** Which statuses each status may move to. Start = UPCOMING→ACTIVE,
 * Complete = ACTIVE→COMPLETED; ARCHIVED hides the batch and can be reopened
 * as UPCOMING. Never touches Enrollment — a learner's access is not derived
 * from the batch's status. */
const ALLOWED_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  UPCOMING: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["UPCOMING"],
};

export async function setBatchStatus(batchId: string, status: BatchStatus): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = batchStatusSchema.safeParse({ status });
  if (!parsed.success) return { ok: false, error: "Choose a valid status." };

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { status: true, program: { select: { status: true } } },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.status === parsed.data.status) return { ok: true }; // idempotent
  if (!ALLOWED_TRANSITIONS[batch.status].includes(parsed.data.status)) {
    return { ok: false, error: `A batch can't go from ${batch.status} to ${parsed.data.status}.` };
  }
  if (batch.program.status === "ARCHIVED" && parsed.data.status !== "ARCHIVED" && parsed.data.status !== "COMPLETED") {
    return { ok: false, error: "Restore the program before reopening one of its batches." };
  }

  await prisma.batch.update({ where: { id: batchId }, data: { status: parsed.data.status } });
  revalidateBatches(batchId);
  return { ok: true };
}

/** Thin wrappers so the batch page can use the existing mentor-assignment
 * actions (users/actions.ts — role check, duplicate check) and also get its
 * own paths revalidated. */
export async function addBatchMentor(batchId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = batchMentorSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const result = await assignMentorToBatch(parsed.data.mentorId, { batchId, roleLabel: parsed.data.roleLabel });
  if (result.ok) revalidateBatches(batchId);
  return result;
}

export async function removeBatchMentor(batchId: string, assignmentId: string): Promise<ActionResult> {
  await requireRole("ADMIN");

  const assignment = await prisma.mentorAssignment.findUnique({
    where: { id: assignmentId },
    select: { batchId: true, mentorId: true },
  });
  if (!assignment || assignment.batchId !== batchId) return { ok: false, error: "Assignment not found." };

  const result = await removeMentorFromBatch(assignmentId, assignment.mentorId);
  if (result.ok) revalidateBatches(batchId);
  return result;
}
