"use client"; // pending state + the archive confirm step

import { useState, useTransition } from "react";
import type { ContentStatus } from "@prisma/client";
import { setProgramStatus } from "./actions";

const OUTLINE_BUTTON =
  "rounded-lg border border-outline bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50";
const PRIMARY_BUTTON =
  "rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50";

export function ProgramStatusControls({
  programId,
  status,
  openBatchCount,
}: {
  programId: string;
  status: ContentStatus;
  /** UPCOMING + ACTIVE batches — what archiving would also archive. */
  openBatchCount: number;
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: ContentStatus): void {
    setError(null);
    startTransition(async () => {
      const result = await setProgramStatus(programId, { status: next });
      if (result.ok) setConfirmingArchive(false);
      else setError(result.error);
    });
  }

  if (confirmingArchive) {
    return (
      <div className="flex w-full flex-col gap-sm rounded-xl border border-error/30 bg-error-container/20 p-lg sm:max-w-md">
        <p className="font-label-md text-label-md text-on-surface">Archive this program?</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          It disappears from the public catalog
          {openBatchCount > 0
            ? `, and its ${openBatchCount} upcoming or active batch${openBatchCount === 1 ? "" : "es"} will be archived too — restoring the program later does not reopen them`
            : ""}
          . Learners who already have access keep it. Nothing is deleted.
        </p>
        {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
        <div className="flex gap-sm">
          <button
            type="button"
            disabled={isPending}
            onClick={() => change("ARCHIVED")}
            className="rounded-full bg-error px-lg py-sm font-label-md text-label-md text-on-error transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Archiving..." : "Confirm Archive"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingArchive(false)}
            className="rounded-full bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-sm sm:items-end">
      <div className="flex flex-wrap gap-sm">
        {status === "ARCHIVED" ? (
          <button type="button" disabled={isPending} onClick={() => change("DRAFT")} className={OUTLINE_BUTTON}>
            {isPending ? "Restoring..." : "Restore as Draft"}
          </button>
        ) : (
          <button type="button" disabled={isPending} onClick={() => setConfirmingArchive(true)} className={OUTLINE_BUTTON}>
            Archive
          </button>
        )}
        {status === "PUBLISHED" ? (
          <button type="button" disabled={isPending} onClick={() => change("DRAFT")} className={OUTLINE_BUTTON}>
            {isPending ? "Saving..." : "Unpublish"}
          </button>
        ) : null}
        {status === "DRAFT" ? (
          <button type="button" disabled={isPending} onClick={() => change("PUBLISHED")} className={PRIMARY_BUTTON}>
            {isPending ? "Publishing..." : "Publish"}
          </button>
        ) : null}
      </div>
      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
    </div>
  );
}
