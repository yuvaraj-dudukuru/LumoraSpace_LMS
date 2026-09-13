"use client"; // needs live local score/feedback state and 3 separate pending actions

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveReviewDraft, submitReview } from "./actions";

type Criterion = { id: string; name: string; description: string | null; maxScore: number; order: number };

export function RubricScoringForm({
  submissionId,
  criteria,
  initialScores,
  initialFeedback,
}: {
  submissionId: string;
  criteria: Criterion[];
  initialScores: { criterionId: string; score: number }[];
  initialFeedback: string;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const entry of initialScores) map[entry.criterionId] = String(entry.score);
    return map;
  });
  const [feedback, setFeedback] = useState(initialFeedback);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"draft" | "approve" | "revise" | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = criteria.reduce((sum, criterion) => sum + (Number(scores[criterion.id]) || 0), 0);
  const totalMax = criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

  function buildRubricScores() {
    return criteria
      .filter((criterion) => scores[criterion.id] !== undefined && scores[criterion.id] !== "")
      .map((criterion) => ({ criterionId: criterion.id, score: Number(scores[criterion.id]) }));
  }

  function handleScoreChange(criterionId: string, value: string) {
    setScores((prev) => ({ ...prev, [criterionId]: value }));
  }

  function handleSaveDraft() {
    setError(null);
    setPendingAction("draft");
    startTransition(async () => {
      const result = await saveReviewDraft(submissionId, {
        rubricScores: buildRubricScores(),
        overallFeedback: feedback,
      });
      if (result.ok) router.refresh();
      else setError(result.error);
      setPendingAction(null);
    });
  }

  function handleSubmit(outcome: "APPROVED" | "REVISION_REQUESTED") {
    setError(null);
    setPendingAction(outcome === "APPROVED" ? "approve" : "revise");
    startTransition(async () => {
      const result = await submitReview(submissionId, {
        rubricScores: buildRubricScores(),
        overallFeedback: feedback,
        outcome,
      });
      if (result.ok) router.refresh();
      else setError(result.error);
      setPendingAction(null);
    });
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-lg">
        <span className="font-label-md text-label-md text-on-surface-variant">Current Score</span>
        <span className="font-headline-md text-headline-md text-primary">
          {total} / {totalMax}
        </span>
      </div>

      <div className="flex flex-col gap-md">
        {criteria.map((criterion) => (
          <div key={criterion.id} className="flex flex-col gap-xs rounded-lg bg-surface-container-low p-md">
            <div className="flex items-center justify-between gap-md">
              <div>
                <p className="font-label-md text-label-md text-on-surface">{criterion.name}</p>
                {criterion.description ? (
                  <p className="font-body-md text-sm text-on-surface-variant">{criterion.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <input
                  type="number"
                  min={0}
                  max={criterion.maxScore}
                  value={scores[criterion.id] ?? ""}
                  onChange={(event) => handleScoreChange(criterion.id, event.target.value)}
                  className="w-16 rounded-lg border border-outline-variant bg-surface px-sm py-xs text-right font-label-md text-label-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="font-label-sm text-label-sm text-on-surface-variant">/ {criterion.maxScore}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="overall-feedback" className="font-label-md text-label-md text-on-surface">
          Overall Feedback
        </label>
        <textarea
          id="overall-feedback"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={6}
          placeholder="Write constructive feedback for the learner…"
          className="w-full rounded-lg border border-outline-variant bg-surface p-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}

      <div className="flex flex-col gap-sm sm:flex-row">
        <Button onClick={() => handleSubmit("APPROVED")} disabled={isPending} className="flex-1">
          {pendingAction === "approve" ? "Approving…" : "Approve & Send Feedback"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => handleSubmit("REVISION_REQUESTED")}
          disabled={isPending}
          className="flex-1"
        >
          {pendingAction === "revise" ? "Requesting…" : "Request Revision"}
        </Button>
        <Button variant="outline" onClick={handleSaveDraft} disabled={isPending}>
          {pendingAction === "draft" ? "Saving…" : "Save Draft"}
        </Button>
      </div>
    </div>
  );
}
