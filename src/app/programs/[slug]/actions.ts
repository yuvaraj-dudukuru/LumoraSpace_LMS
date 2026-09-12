"use server";

import { Prisma, Role, BatchStatus, EnrollmentStatus, AccessState } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { enrollSchema } from "@/lib/validations/enroll";

export type EnrollResult = { ok: true } | { ok: false; error: string };

export async function enrollAction(programId: string, formData: FormData): Promise<EnrollResult> {
  const user = await requireRole(Role.LEARNER);

  const parsed = enrollSchema.safeParse({ batchId: formData.get("batchId") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid selection" };
  }

  // Re-verify server-side — the batchId came from the client.
  const batch = await prisma.batch.findFirst({
    where: {
      id: parsed.data.batchId,
      programId,
      status: { in: [BatchStatus.UPCOMING, BatchStatus.ACTIVE] },
    },
    select: { id: true, capacity: true },
  });
  if (!batch) {
    return { ok: false, error: "This cohort is not currently open for enrollment." };
  }

  if (batch.capacity !== null) {
    const enrolledCount = await prisma.enrollment.count({
      where: { batchId: batch.id, status: { not: EnrollmentStatus.CANCELLED } },
    });
    if (enrolledCount >= batch.capacity) {
      return { ok: false, error: "This cohort is full. Please choose another batch." };
    }
  }

  try {
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        programId,
        batchId: batch.id,
        // DECISIONS.md Q22 — payments are stubbed, so a learner-initiated
        // enrollment always starts PENDING/AWAITING; an admin grants access.
        status: EnrollmentStatus.PENDING,
        accessState: AccessState.AWAITING,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "You're already enrolled in this cohort." };
    }
    throw error;
  }

  revalidatePath("/learn/my-learning");
  revalidatePath("/learn");
  return { ok: true };
}
