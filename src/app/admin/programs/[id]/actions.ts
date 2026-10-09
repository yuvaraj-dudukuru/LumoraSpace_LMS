"use server";

import { revalidatePath } from "next/cache";
import type { ContentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { setProgramStatusSchema } from "@/lib/validations/admin";

export type ProgramActionResult = { ok: true } | { ok: false; error: string };

/** Same rules as prisma/set-program-status.ts, which this mirrors: archiving
 * also archives the program's UPCOMING/ACTIVE batches in the same
 * transaction; nothing is deleted, Enrollment is never touched (a GRANTED
 * learner keeps their content), and un-archiving does NOT restore batches. */
export async function setProgramStatus(id: string, input: { status: ContentStatus }): Promise<ProgramActionResult> {
  await requireRole("ADMIN");

  const parsed = setProgramStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid status." };
  const target = parsed.data.status;

  const program = await prisma.program.findUnique({ where: { id }, select: { status: true, slug: true } });
  if (!program) return { ok: false, error: "Program not found." };
  if (program.status === target) return { ok: true }; // idempotent

  await prisma.$transaction([
    prisma.program.update({ where: { id }, data: { status: target } }),
    ...(target === "ARCHIVED"
      ? [
          prisma.batch.updateMany({
            where: { programId: id, status: { in: ["UPCOMING", "ACTIVE"] } },
            data: { status: "ARCHIVED" },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/admin/programs/${id}`);
  revalidatePath("/admin/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${program.slug}`);
  return { ok: true };
}
