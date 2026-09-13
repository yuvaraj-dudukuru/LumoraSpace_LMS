"use client"; // per-row action buttons need pending-transition state

import { useState, useTransition } from "react";
import type { AccessState, EnrollmentStatus } from "@prisma/client";
import { grantAccess, suspendAccess, updateEnrollmentStatus } from "./actions";

export function EnrollmentRowActions({
  enrollmentId,
  accessState,
  status,
}: {
  enrollmentId: string;
  accessState: AccessState;
  status: EnrollmentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  const canCancelOrDrop = status !== "CANCELLED" && status !== "DROPPED" && status !== "COMPLETED";

  return (
    <div className="flex flex-col items-end gap-xs">
      <div className="flex items-center gap-sm">
        {accessState === "AWAITING" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => grantAccess(enrollmentId))}
            className="rounded-full bg-primary px-md py-xs font-label-sm text-label-sm text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Grant
          </button>
        ) : null}
        {accessState === "GRANTED" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => suspendAccess(enrollmentId))}
            className="rounded-full bg-error-container px-md py-xs font-label-sm text-label-sm text-on-error-container transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Suspend
          </button>
        ) : null}
        {canCancelOrDrop ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => updateEnrollmentStatus(enrollmentId, { status: "DROPPED" }))}
            className="rounded-full bg-surface-container px-md py-xs font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Drop
          </button>
        ) : null}
        {canCancelOrDrop ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => updateEnrollmentStatus(enrollmentId, { status: "CANCELLED" }))}
            className="rounded-full bg-surface-container px-md py-xs font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
    </div>
  );
}
