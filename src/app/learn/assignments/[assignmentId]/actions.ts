"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveAssignmentProgram, nextAttemptNumber, canSubmitNewAttempt } from "@/lib/queries/assignments";
import { submitAssignmentSchema } from "@/lib/validations/assignment";
import { isKnownStorageUrl } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export type SubmitAssignmentResult = { ok: true; submissionId: string } | { ok: false; error: string };

/** assignmentId is attacker-controlled — re-resolves its program and
 * re-verifies a granted enrollment server-side on every call.
 *
 * dueAt is informational only in MVP: a late submission is accepted here and
 * only flagged in the UI, never blocked. */
export async function submitAssignment(
  assignmentId: string,
  input: { githubUrl?: string; notes?: string; fileUrl?: string },
): Promise<SubmitAssignmentResult> {
  const resolved = await resolveAssignmentProgram(assignmentId);
  if (!resolved) return { ok: false, error: "Assignment not found." };

  const enrollment = await requireGrantedEnrollment(resolved.programId);

  const parsed = submitAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid submission." };
  }

  // fileUrl comes straight from the client (the upload component reports back
  // whatever publicUrl the presigned-url action returned) — never trust it
  // blindly. This can't confirm the object was actually uploaded, but it
  // rejects anything that isn't even shaped like one of our own bucket URLs.
  if (parsed.data.fileUrl && !isKnownStorageUrl(parsed.data.fileUrl)) {
    return { ok: false, error: "Invalid file URL." };
  }

  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: {
      allowGithubUrl: true,
      maxAttempts: true,
      submissions: {
        where: { enrollmentId: enrollment.id, status: { not: "NOT_STARTED" } },
        orderBy: { attemptNumber: "asc" },
        select: { attemptNumber: true, status: true },
      },
    },
  });

  if (parsed.data.githubUrl && !assignment.allowGithubUrl) {
    return { ok: false, error: "This assignment doesn't accept a GitHub URL." };
  }

  if (!canSubmitNewAttempt(assignment.submissions, assignment.maxAttempts)) {
    const latest = assignment.submissions.at(-1);
    const error =
      latest?.status === "SUBMITTED" || latest?.status === "UNDER_REVIEW"
        ? "You already have a submission awaiting review."
        : "You've used all your allowed attempts for this assignment.";
    return { ok: false, error };
  }

  const attemptNumber = nextAttemptNumber(assignment.submissions);

  try {
    // upsert (not create): a NOT_STARTED row from the seed can already
    // occupy this exact attemptNumber slot (see queries/assignments.ts) —
    // this converts it into the real submission instead of colliding with
    // it. Behaves identically to a plain create when no such row exists.
    // The compound unique key is still what's relied on; P2002 remains a
    // real safety net for a genuine concurrent double-submit race.
    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_enrollmentId_attemptNumber: { assignmentId, enrollmentId: enrollment.id, attemptNumber },
      },
      create: {
        assignmentId,
        enrollmentId: enrollment.id,
        attemptNumber,
        status: "SUBMITTED",
        githubUrl: parsed.data.githubUrl,
        notes: parsed.data.notes,
        fileUrl: parsed.data.fileUrl,
        submittedAt: new Date(),
      },
      update: {
        status: "SUBMITTED",
        githubUrl: parsed.data.githubUrl ?? null,
        notes: parsed.data.notes ?? null,
        fileUrl: parsed.data.fileUrl ?? null,
        submittedAt: new Date(),
      },
    });

    revalidatePath(`/learn/assignments/${assignmentId}`);
    revalidatePath(`/learn/submissions/${submission.id}`);
    revalidatePath(`/learn/programs/${resolved.programId}`);
    revalidatePath("/learn");

    return { ok: true, submissionId: submission.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A submission for this attempt already exists." };
    }
    throw error;
  }
}
