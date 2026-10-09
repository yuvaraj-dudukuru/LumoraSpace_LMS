"use client"; // the option rows depend on the chosen question type, and rows are added/removed

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { QuestionType } from "@prisma/client";
import { MAX_CHOICE_OPTIONS, MIN_CHOICE_OPTIONS } from "@/lib/validations/admin-content";

const CONTROL =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20";
const LABEL = "font-label-md text-label-md text-on-surface";
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

type Initial = {
  type: QuestionType;
  text: string;
  points: number;
  explanation: string | null;
  options: { text: string; isCorrect: boolean }[];
};

type OptionRow = { key: number; text: string };

/** The inside of the Add/Edit Question dialog. Still plain named inputs —
 * ModalForm collects them as FormData (`optionText` repeats per row,
 * `correct` is the chosen row's index) and parseQuestionForm validates. */
export function QuestionFields({ initial }: { initial?: Initial }) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? "MULTIPLE_CHOICE");
  const [rows, setRows] = useState<OptionRow[]>(() => {
    const seed = initial?.type === "MULTIPLE_CHOICE" && initial.options.length > 0 ? initial.options : [{ text: "" }, { text: "" }];
    return seed.map((option, index) => ({ key: index, text: option.text }));
  });
  const [nextKey, setNextKey] = useState(rows.length);
  const [correct, setCorrect] = useState<number>(() => {
    const index = initial?.options.findIndex((option) => option.isCorrect) ?? -1;
    return index >= 0 ? index : -1;
  });

  function addRow(): void {
    setRows((prev) => [...prev, { key: nextKey, text: "" }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(index: number): void {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    // Keep pointing at the same option; clear it if that option was removed.
    setCorrect((prev) => (prev === index ? -1 : prev > index ? prev - 1 : prev));
  }

  function changeType(next: QuestionType): void {
    setType(next);
    setCorrect(-1); // an index means something different in each type
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="flex flex-col gap-xs">
          <label htmlFor="question-type" className={LABEL}>
            Question type
          </label>
          <select
            id="question-type"
            name="type"
            value={type}
            onChange={(event) => changeType(event.target.value as QuestionType)}
            className={CONTROL}
          >
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE">True / False</option>
            <option value="CODE_SNIPPET">Code Snippet (written answer)</option>
          </select>
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor="question-points" className={LABEL}>
            Marks
          </label>
          <input
            id="question-points"
            name="points"
            type="number"
            required
            min={1}
            max={100}
            defaultValue={initial?.points ?? 5}
            className={CONTROL}
          />
        </div>
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="question-text" className={LABEL}>
          Question text
        </label>
        <textarea id="question-text" name="text" required rows={3} maxLength={2000} defaultValue={initial?.text} className={CONTROL} />
      </div>

      {type === "MULTIPLE_CHOICE" ? (
        <fieldset className="flex flex-col gap-sm">
          <legend className={`${LABEL} pb-sm`}>Options (select the correct answer)</legend>
          {rows.map((row, index) => (
            <div
              key={row.key}
              className={`flex items-center gap-sm rounded-lg border p-sm ${correct === index ? "border-primary bg-primary-fixed" : "border-outline-variant"}`}
            >
              <input
                type="radio"
                name="correct"
                value={index}
                checked={correct === index}
                onChange={() => setCorrect(index)}
                aria-label={`Option ${OPTION_LETTERS[index]} is correct`}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="w-4 shrink-0 font-label-md text-label-md text-on-surface-variant">{OPTION_LETTERS[index]}</span>
              <input
                type="text"
                name="optionText"
                required
                maxLength={500}
                defaultValue={row.text}
                aria-label={`Option ${OPTION_LETTERS[index]} text`}
                className="min-w-0 flex-1 bg-transparent font-body-md text-body-md text-on-surface outline-none"
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length <= MIN_CHOICE_OPTIONS}
                aria-label={`Remove option ${OPTION_LETTERS[index]}`}
                className="rounded p-xs text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {rows.length < MAX_CHOICE_OPTIONS ? (
            <button
              type="button"
              onClick={addRow}
              className="flex w-fit items-center gap-xs font-label-md text-label-md text-primary hover:underline"
            >
              <Plus className="h-4 w-4" /> Add Option
            </button>
          ) : null}
        </fieldset>
      ) : null}

      {type === "TRUE_FALSE" ? (
        <fieldset className="flex flex-col gap-sm">
          <legend className={`${LABEL} pb-sm`}>Correct answer</legend>
          <div className="flex gap-md">
            {["True", "False"].map((label, index) => (
              <label
                key={label}
                className={`flex flex-1 items-center gap-sm rounded-lg border p-md font-body-md text-body-md text-on-surface ${correct === index ? "border-primary bg-primary-fixed" : "border-outline-variant"}`}
              >
                <input
                  type="radio"
                  name="correct"
                  value={index}
                  checked={correct === index}
                  onChange={() => setCorrect(index)}
                  className="h-4 w-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {type === "CODE_SNIPPET" ? (
        <p className="rounded-lg bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant">
          Learners type a free-text answer. It is saved but not auto-graded, so these marks are never awarded automatically.
        </p>
      ) : null}

      <div className="flex flex-col gap-xs">
        <label htmlFor="question-explanation" className={LABEL}>
          Explanation <span className="text-on-surface-variant">(optional)</span>
        </label>
        <textarea
          id="question-explanation"
          name="explanation"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.explanation ?? undefined}
          placeholder="Explain why the answer is correct..."
          className={CONTROL}
        />
      </div>
    </>
  );
}
