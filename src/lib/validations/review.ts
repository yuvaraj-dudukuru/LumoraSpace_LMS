import { z } from "zod";

export type RubricScoreInput = { criterionId: string; score: number };
export type RubricCriterionRef = { id: string; maxScore: number };
export type ValidateRubricScoresResult = { ok: true } | { ok: false; error: string };

/** Ownership + bounds only — a draft may legitimately be partial (a mentor
 * scoring some criteria and coming back later). Rejects a criterionId that
 * doesn't belong to this assignment's rubric, a duplicate entry for the same
 * criterion, and any score outside 0..maxScore. Never trust the client's
 * `min`/`max` input attributes — this is the real boundary. */
export function validateRubricScoreEntries(
  submitted: RubricScoreInput[],
  criteria: RubricCriterionRef[],
): ValidateRubricScoresResult {
  const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  const seen = new Set<string>();
  for (const entry of submitted) {
    const criterion = criteriaById.get(entry.criterionId);
    if (!criterion) {
      return {
        ok: false,
        error: "One of the submitted scores references a criterion that doesn't belong to this assignment.",
      };
    }
    if (seen.has(entry.criterionId)) {
      return { ok: false, error: "Duplicate score submitted for the same criterion." };
    }
    seen.add(entry.criterionId);

    if (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > criterion.maxScore) {
      return { ok: false, error: `Score must be a whole number between 0 and ${criterion.maxScore}.` };
    }
  }

  return { ok: true };
}

/** Everything validateRubricScoreEntries checks, plus completeness — a final
 * decision (submitReview) needs a score for every criterion so the computed
 * total is never partial. */
export function validateRubricScoresComplete(
  submitted: RubricScoreInput[],
  criteria: RubricCriterionRef[],
): ValidateRubricScoresResult {
  const entries = validateRubricScoreEntries(submitted, criteria);
  if (!entries.ok) return entries;

  if (submitted.length !== criteria.length) {
    return { ok: false, error: "Every rubric criterion must have a score before submitting." };
  }
  return { ok: true };
}

const rubricScoreSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number(),
});

export const saveReviewDraftSchema = z.object({
  rubricScores: z.array(rubricScoreSchema),
  overallFeedback: z.string().max(10_000),
});

export const submitReviewSchema = z.object({
  rubricScores: z.array(rubricScoreSchema),
  overallFeedback: z.string().max(10_000),
  outcome: z.enum(["APPROVED", "REVISION_REQUESTED"]),
});
