"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireMentorForBatch } from "@/lib/auth-guards";
import { getSubmissionForReview } from "@/lib/queries/mentor";
import {
  saveReviewDraftSchema,
  submitReviewSchema,
  validateRubricScoreEntries,
  validateRubricScoresComplete,
} from "@/lib/validations/review";
import { prisma } from "@/lib/prisma";
import { sendAssignmentReviewedEmail } from "@/lib/mail";

type AuthorizedSubmission = Awaited<ReturnType<typeof getSubmissionForReview>>;

type AuthResult =
  | { ok: true; submission: NonNullable<AuthorizedSubmission>; mentorId: string }
  | { ok: false; error: string };

/** submissionId is attacker-controlled — every action re-resolves its batch
 * and re-verifies requireMentorForBatch, never trusting the calling page. */
async function resolveAndAuthorize(submissionId: string): Promise<AuthResult> {
  const submission = await getSubmissionForReview(submissionId);
  if (!submission) return { ok: false, error: "Submission not found." };

  const mentor = await requireMentorForBatch(submission.batchId);
  return { ok: true, submission, mentorId: mentor.id };
}

function revalidateSubmission(submissionId: string): void {
  revalidatePath(`/mentor/submissions/${submissionId}`);
  revalidatePath("/mentor/submissions");
  revalidatePath("/mentor");
}

export type ClaimForReviewResult = { ok: true } | { ok: false; error: string };

/** SUBMITTED -> UNDER_REVIEW, creating the draft Review that tracks WHO
 * claimed it (Submission has no reviewer column of its own). Idempotent for
 * the same mentor; a different mentor's claim blocks. A pre-existing
 * UNDER_REVIEW row with no Review at all (seeded before this milestone's
 * ownership concept existed) is adopted rather than left permanently stuck. */
export async function claimForReview(submissionId: string): Promise<ClaimForReviewResult> {
  const auth = await resolveAndAuthorize(submissionId);
  if (!auth.ok) return auth;
  const { submission, mentorId } = auth;

  if (submission.status !== "SUBMITTED" && submission.status !== "UNDER_REVIEW") {
    return { ok: false, error: "This submission isn't awaiting review." };
  }

  if (submission.status === "UNDER_REVIEW" && submission.review) {
    if (submission.review.mentorId === mentorId) return { ok: true }; // idempotent
    return { ok: false, error: `${submission.review.mentorName} is already reviewing this submission.` };
  }

  try {
    await prisma.$transaction([
      prisma.review.upsert({
        where: { submissionId },
        create: { submissionId, mentorId, overallFeedback: "" },
        update: { mentorId },
      }),
      prisma.submission.update({ where: { id: submissionId }, data: { status: "UNDER_REVIEW" } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Another mentor just claimed this submission." };
    }
    throw error;
  }

  revalidateSubmission(submissionId);
  return { ok: true };
}

function verifyOwnsDraft(submission: NonNullable<AuthorizedSubmission>, mentorId: string): string | null {
  if (submission.status !== "UNDER_REVIEW") return "Claim this submission before saving or submitting a review.";
  if (!submission.review || submission.review.mentorId !== mentorId) {
    return "You haven't claimed this submission.";
  }
  return null;
}

export type SaveReviewDraftResult = { ok: true } | { ok: false; error: string };

/** Upserts Review + RubricScores without setting outcome/reviewedAt —
 * Submission stays UNDER_REVIEW. A draft may be partial. */
export async function saveReviewDraft(
  submissionId: string,
  input: { rubricScores: { criterionId: string; score: number }[]; overallFeedback: string },
): Promise<SaveReviewDraftResult> {
  const auth = await resolveAndAuthorize(submissionId);
  if (!auth.ok) return auth;
  const { submission, mentorId } = auth;

  const ownershipError = verifyOwnsDraft(submission, mentorId);
  if (ownershipError) return { ok: false, error: ownershipError };

  const parsed = saveReviewDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid draft." };

  const validation = validateRubricScoreEntries(parsed.data.rubricScores, submission.assignment.rubricCriteria);
  if (!validation.ok) return validation;

  const reviewId = submission.review!.id;
  await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { overallFeedback: parsed.data.overallFeedback },
    }),
    ...parsed.data.rubricScores.map((entry) =>
      prisma.rubricScore.upsert({
        where: { reviewId_criterionId: { reviewId, criterionId: entry.criterionId } },
        create: { reviewId, criterionId: entry.criterionId, score: entry.score },
        update: { score: entry.score },
      }),
    ),
  ]);

  revalidateSubmission(submissionId);
  return { ok: true };
}

export type SubmitReviewResult = { ok: true } | { ok: false; error: string };

/** Finalizes the review: every criterion must be scored (validated server-
 * side regardless of what the client sent), sets outcome/reviewedAt/mentorId
 * and the computed score/maxScore totals, and flips Submission.status to
 * REVIEWED (APPROVED) or REVISION_REQUESTED. Never touches
 * Enrollment.progressPercent — assignments don't feed progress (M5a D3). */
export async function submitReview(
  submissionId: string,
  input: {
    rubricScores: { criterionId: string; score: number }[];
    overallFeedback: string;
    outcome: "APPROVED" | "REVISION_REQUESTED";
  },
): Promise<SubmitReviewResult> {
  const auth = await resolveAndAuthorize(submissionId);
  if (!auth.ok) return auth;
  const { submission, mentorId } = auth;

  const ownershipError = verifyOwnsDraft(submission, mentorId);
  if (ownershipError) return { ok: false, error: ownershipError };

  const parsed = submitReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review." };

  const validation = validateRubricScoresComplete(parsed.data.rubricScores, submission.assignment.rubricCriteria);
  if (!validation.ok) return validation;

  const reviewId = submission.review!.id;
  const totalScore = parsed.data.rubricScores.reduce((sum, entry) => sum + entry.score, 0);
  const totalMaxScore = submission.assignment.rubricCriteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  const submissionStatus = parsed.data.outcome === "APPROVED" ? "REVIEWED" : "REVISION_REQUESTED";

  await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: {
        overallFeedback: parsed.data.overallFeedback,
        outcome: parsed.data.outcome,
        reviewedAt: new Date(),
        mentorId,
        score: totalScore,
        maxScore: totalMaxScore,
      },
    }),
    ...parsed.data.rubricScores.map((entry) =>
      prisma.rubricScore.upsert({
        where: { reviewId_criterionId: { reviewId, criterionId: entry.criterionId } },
        create: { reviewId, criterionId: entry.criterionId, score: entry.score },
        update: { score: entry.score },
      }),
    ),
    prisma.submission.update({ where: { id: submissionId }, data: { status: submissionStatus } }),
  ]);

  revalidateSubmission(submissionId);
  revalidatePath(`/learn/submissions/${submissionId}`);
  revalidatePath(`/learn/assignments/${submission.assignment.id}`);

  // Fire-and-forget-safe: sendAssignmentReviewedEmail never throws (see
  // mail.ts), so an email/Resend failure here can't undo the review that
  // already committed above or fail this action. submission.learner.email
  // comes from getSubmissionForReview's own DB read, not the caller's
  // session (the caller here is the mentor, not the learner, anyway).
  // The feedback link is built inside mail.ts from APP_URL — absolute, or
  // the send is skipped with a log.
  await sendAssignmentReviewedEmail(submission.learner.email, {
    learnerName: submission.learner.name,
    assignmentTitle: submission.assignment.title,
    outcome: parsed.data.outcome,
    submissionId,
  });

  return { ok: true };
}
