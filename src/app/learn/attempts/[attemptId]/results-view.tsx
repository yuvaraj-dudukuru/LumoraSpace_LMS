import { CheckCircle2, XCircle, MinusCircle, Clock3 } from "lucide-react";
import type { GradedAttemptQuestion } from "@/lib/queries/assessments";

type Props = {
  title: string;
  scorePercent: number | null;
  passed: boolean | null;
  passingScorePercent: number | null;
  showResultsImmediately: boolean;
  questions: GradedAttemptQuestion[] | null;
};

export function ResultsView({ title, scorePercent, passed, passingScorePercent, showResultsImmediately, questions }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-xl py-2xl">
      <header className="flex flex-col items-center gap-sm text-center">
        <p className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
          {title}
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Assessment Submitted</h1>
        <div className="flex items-center gap-md">
          <span className="font-display-lg-mobile text-display-lg-mobile text-primary">
            {scorePercent === null ? "—" : `${scorePercent}%`}
          </span>
          {passed === null ? null : (
            <span
              className={`rounded-full px-md py-xs font-label-md text-label-md ${
                passed ? "bg-success-container text-success" : "bg-error-container text-on-error-container"
              }`}
            >
              {passed ? "Passed" : "Not Passed"}
            </span>
          )}
        </div>
        {passingScorePercent !== null ? (
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            Passing score: {passingScorePercent}%
          </p>
        ) : null}
      </header>

      {!showResultsImmediately ? (
        <div className="flex flex-col items-center gap-sm rounded-xl bg-surface-container-low p-xl text-center">
          <Clock3 className="h-6 w-6 text-on-surface-variant" />
          <p className="font-body-md text-body-md text-on-surface-variant">
            Detailed results aren&apos;t available for this assessment.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-lg">
          {questions?.map((question, index) => (
            <QuestionResult key={question.id} question={question} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionResult({ question, index }: { question: GradedAttemptQuestion; index: number }) {
  if (question.type === "CODE_SNIPPET") {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface p-lg">
        <div className="mb-sm flex items-start justify-between gap-md">
          <p className="font-title-lg text-title-lg text-on-surface">
            {index + 1}. {question.text}
          </p>
          <span className="shrink-0 rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
            Pending manual review
          </span>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg bg-surface-container-low p-md font-mono text-body-md text-on-surface">
          {question.freeTextAnswer || "No answer submitted."}
        </pre>
        {question.explanation ? (
          <p className="mt-sm font-body-md text-body-md text-on-surface-variant">{question.explanation}</p>
        ) : null}
      </div>
    );
  }

  const selectedOption = question.options.find((option) => option.id === question.selectedOptionId);
  const isCorrect = selectedOption?.isCorrect ?? false;

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface p-lg">
      <div className="mb-md flex items-start gap-sm">
        {question.selectedOptionId ? (
          isCorrect ? (
            <CheckCircle2 className="mt-xs h-5 w-5 shrink-0 text-success" />
          ) : (
            <XCircle className="mt-xs h-5 w-5 shrink-0 text-error" />
          )
        ) : (
          <MinusCircle className="mt-xs h-5 w-5 shrink-0 text-on-surface-variant" />
        )}
        <p className="font-title-lg text-title-lg text-on-surface">
          {index + 1}. {question.text}
        </p>
      </div>
      <ul className="flex flex-col gap-xs">
        {question.options.map((option) => {
          const isSelected = option.id === question.selectedOptionId;
          const style = option.isCorrect
            ? "border-success bg-success-container text-on-surface"
            : isSelected
              ? "border-error bg-error-container text-on-surface"
              : "border-outline-variant/30 bg-surface text-on-surface-variant";
          return (
            <li key={option.id} className={`rounded-lg border px-md py-sm font-body-md text-body-md ${style}`}>
              <span className="font-label-md text-label-md">{option.label}.</span> {option.text}
            </li>
          );
        })}
      </ul>
      {question.explanation ? (
        <p className="mt-md rounded-lg bg-surface-container-low p-md font-body-md text-body-md text-on-surface-variant">
          {question.explanation}
        </p>
      ) : null}
    </div>
  );
}
