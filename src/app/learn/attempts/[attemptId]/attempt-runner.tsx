"use client"; // live per-question state, a countdown timer, and debounced autosave all need client state

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveAttemptQuestion } from "@/lib/queries/assessments";
import { saveAnswer, toggleFlag, submitAttempt } from "./actions";

const FREE_TEXT_DEBOUNCE_MS = 300;

type LocalAnswer = { selectedOptionId: string | null; freeTextAnswer: string | null; flagged: boolean };

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function AttemptRunner({
  attemptId,
  assessmentTitle,
  deadlineIso,
  questions,
}: {
  attemptId: string;
  assessmentTitle: string;
  deadlineIso: string | null;
  questions: LiveAttemptQuestion[];
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() => {
    const initial: Record<string, LocalAnswer> = {};
    for (const question of questions) {
      initial[question.id] = {
        selectedOptionId: question.selectedOptionId,
        freeTextAnswer: question.freeTextAnswer,
        flagged: question.flagged,
      };
    }
    return initial;
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const autoSubmittedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deadline = deadlineIso ? new Date(deadlineIso).getTime() : null;
  const [remainingMs, setRemainingMs] = useState<number | null>(() => (deadline ? deadline - Date.now() : null));

  // Cosmetic countdown only — the server independently re-checks
  // startedAt + timeLimitMins on every submit and on every page load, so a
  // paused tab or a tampered client clock can't extend the real deadline.
  useEffect(() => {
    if (deadline === null) return;
    const interval = setInterval(() => {
      const next = deadline - Date.now();
      setRemainingMs(next);
      if (next <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        clearInterval(interval);
        submitAttempt(attemptId).then(() => router.refresh());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, attemptId, router]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];

  function persistAnswer(questionId: string, patch: { selectedOptionId?: string; freeTextAnswer?: string }) {
    setSaveStatus("saving");
    saveAnswer(attemptId, questionId, patch)
      .then((result) => setSaveStatus(result.ok ? "saved" : "idle"))
      .catch(() => setSaveStatus("idle"));
  }

  function handleSelectOption(optionId: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], selectedOptionId: optionId } }));
    persistAnswer(currentQuestion.id, { selectedOptionId: optionId });
  }

  function handleFreeTextChange(value: string) {
    const questionId = currentQuestion.id;
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], freeTextAnswer: value } }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistAnswer(questionId, { freeTextAnswer: value }), FREE_TEXT_DEBOUNCE_MS);
  }

  function handleToggleFlag() {
    const questionId = currentQuestion.id;
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], flagged: !prev[questionId].flagged } }));
    toggleFlag(attemptId, questionId);
  }

  function handleSubmit() {
    startSubmitTransition(async () => {
      await submitAttempt(attemptId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-lg xl:flex-row xl:items-start xl:gap-xl">
      <div className="flex min-w-0 flex-1 flex-col gap-lg">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-md">
          <h1 className="font-title-lg text-title-lg text-on-surface">{assessmentTitle}</h1>
          {remainingMs !== null ? (
            <span
              className={`flex items-center gap-xs font-label-md text-label-md ${remainingMs < 60_000 ? "text-error" : "text-on-surface-variant"}`}
            >
              <Timer className="h-4 w-4" />
              {formatRemaining(remainingMs)}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <button
            type="button"
            onClick={handleToggleFlag}
            className={`flex items-center gap-xs font-label-md text-label-md ${currentAnswer.flagged ? "text-warning" : "text-on-surface-variant"}`}
          >
            <Flag className="h-4 w-4" />
            {currentAnswer.flagged ? "Flagged" : "Flag for review"}
          </button>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <p className="font-title-lg text-title-lg text-on-surface">{currentQuestion.text}</p>

        {currentQuestion.type === "CODE_SNIPPET" ? (
          <textarea
            value={currentAnswer.freeTextAnswer ?? ""}
            onChange={(event) => handleFreeTextChange(event.target.value)}
            rows={8}
            placeholder="Write your answer…"
            className="w-full rounded-lg border border-outline-variant bg-surface p-md font-mono text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
          />
        ) : (
          <div className="flex flex-col gap-sm">
            {currentQuestion.options.map((option) => {
              const isSelected = currentAnswer.selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(option.id)}
                  className={`flex items-center gap-md rounded-lg border px-lg py-md text-left font-body-md text-body-md transition-colors ${
                    isSelected
                      ? "border-primary bg-primary-fixed text-on-surface"
                      : "border-outline-variant/30 bg-surface text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? "border-primary" : "border-outline"
                    }`}
                  >
                    {isSelected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-outline-variant/30 pt-lg">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          {currentIndex < questions.length - 1 ? (
            <Button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit Assessment"}
            </Button>
          )}
        </div>
      </div>

      <aside className="w-full shrink-0 xl:w-72">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg">
          <div className="mb-md flex items-center justify-between">
            <p className="font-label-sm text-label-sm text-on-surface-variant">Question Navigator</p>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : ""}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-xs">
            {questions.map((question, index) => {
              const answer = answers[question.id];
              const isAnswered = Boolean(answer.selectedOptionId || answer.freeTextAnswer);
              const isCurrent = index === currentIndex;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`relative flex h-9 items-center justify-center rounded-lg font-label-md text-label-md transition-colors ${
                    isCurrent
                      ? "border-2 border-primary text-primary"
                      : isAnswered
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {index + 1}
                  {answer.flagged ? (
                    <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-warning text-warning" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <Button className="mt-lg w-full" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Assessment"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
