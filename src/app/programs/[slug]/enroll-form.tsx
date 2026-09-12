"use client"; // needs batch-selection state and a pending submit button

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EnrollableBatch } from "@/lib/queries/programs";
import { formatDate } from "@/lib/format";
import { enrollAction, type EnrollResult } from "./actions";

type Props = {
  programId: string;
  batches: EnrollableBatch[];
};

const initialState: EnrollResult = { ok: false, error: "" };

export function EnrollForm({ programId, batches }: Props) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id ?? "");
  const [state, formAction, isPending] = useActionState(
    (_prevState: EnrollResult, formData: FormData) => enrollAction(programId, formData),
    initialState,
  );

  if (batches.length === 0) {
    return (
      <p className="rounded-lg bg-surface-container-low p-md font-body-md text-body-md text-on-surface-variant">
        No cohorts are currently open for this program — check back soon.
      </p>
    );
  }

  if (state.ok) {
    return (
      <p className="rounded-lg bg-primary-container p-md font-label-md text-label-md text-on-primary-container">
        You&apos;re enrolled! Your access is pending admin approval — you&apos;ll see this cohort under
        My Learning.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <fieldset className="flex flex-col gap-sm">
        <legend className="mb-xs font-label-md text-label-md text-on-surface">Choose a cohort</legend>
        {batches.map((batch) => (
          <label
            key={batch.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border px-md py-sm transition-colors ${
              selectedBatchId === batch.id
                ? "border-primary bg-primary-container/20"
                : "border-outline-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="flex items-center gap-sm">
              <input
                type="radio"
                name="batchId"
                value={batch.id}
                checked={selectedBatchId === batch.id}
                onChange={() => setSelectedBatchId(batch.id)}
                className="accent-primary"
              />
              <span className="font-label-md text-label-md text-on-surface">{batch.name}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">({batch.status})</span>
            </span>
            <span className="font-body-md text-sm text-on-surface-variant">
              Starts {formatDate(batch.startDate)}
              {batch.capacity !== null ? ` · ${Math.max(batch.capacity - batch.enrolledCount, 0)} seats left` : ""}
            </span>
          </label>
        ))}
      </fieldset>
      {state.error ? <p className="font-label-sm text-label-sm text-error">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enrolling…" : "Enroll Now"}
      </Button>
    </form>
  );
}
