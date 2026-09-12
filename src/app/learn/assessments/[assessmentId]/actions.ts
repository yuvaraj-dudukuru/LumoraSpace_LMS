"use server";

import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveAssessmentProgram } from "@/lib/queries/assessments";
import { prisma } from "@/lib/prisma";

export type StartAttemptResult = { ok: true; attemptId: string } | { ok: false; error: string };

/** assessmentId is attacker-controlled — re-resolves its program and
 * re-verifies a granted enrollment server-side on every call. Resumes an
 * existing IN_PROGRESS attempt rather than creating a second one; otherwise
 * enforces allowedAttempts (0 = unlimited) before creating the next one. */
export async function startAttempt(assessmentId: string): Promise<StartAttemptResult> {
  const resolved = await resolveAssessmentProgram(assessmentId);
  if (!resolved) return { ok: false, error: "Assessment not found." };

  const enrollment = await requireGrantedEnrollment(resolved.programId);

  const assessment = await prisma.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    select: {
      allowedAttempts: true,
      attempts: {
        where: { enrollmentId: enrollment.id },
        select: { id: true, status: true, attemptNumber: true },
        orderBy: { attemptNumber: "desc" },
      },
    },
  });

  const inProgress = assessment.attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  if (inProgress) return { ok: true, attemptId: inProgress.id };

  if (assessment.allowedAttempts !== 0 && assessment.attempts.length >= assessment.allowedAttempts) {
    return { ok: false, error: "No attempts remaining for this assessment." };
  }

  const nextAttemptNumber = (assessment.attempts[0]?.attemptNumber ?? 0) + 1;

  const attempt = await prisma.attempt.create({
    data: { assessmentId, enrollmentId: enrollment.id, attemptNumber: nextAttemptNumber },
  });

  return { ok: true, attemptId: attempt.id };
}
