"use client"; // batch dropdown + pending submit, and per-row remove buttons

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AdminBatchOption } from "@/lib/queries/admin";
import { assignMentorToBatch, removeMentorFromBatch } from "../actions";

type Assignment = { id: string; batchId: string; batchName: string; batchCode: string; roleLabel: string | null };

export function MentorAssignmentForm({
  mentorId,
  assignments,
  batchOptions,
}: {
  mentorId: string;
  assignments: Assignment[];
  batchOptions: AdminBatchOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState(batchOptions[0]?.id ?? "");
  const [roleLabel, setRoleLabel] = useState("");

  const availableBatches = batchOptions.filter((batch) => !assignments.some((a) => a.batchId === batch.id));

  function handleAssign(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await assignMentorToBatch(mentorId, { batchId, roleLabel: roleLabel || undefined });
      if (!result.ok) setError(result.error);
      else setRoleLabel("");
    });
  }

  function handleRemove(assignmentId: string): void {
    setError(null);
    startTransition(async () => {
      const result = await removeMentorFromBatch(assignmentId, mentorId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-md rounded-xl border border-outline-variant/40 bg-surface-container-low p-lg">
      <h2 className="font-title-lg text-title-lg text-on-surface">Batch Assignments</h2>

      {assignments.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">Not assigned to any batch yet.</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex items-center justify-between rounded-lg bg-surface p-md"
            >
              <div>
                <p className="font-label-md text-label-md text-on-surface">
                  {assignment.batchCode} — {assignment.batchName}
                </p>
                {assignment.roleLabel ? (
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{assignment.roleLabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(assignment.id)}
                aria-label={`Remove from ${assignment.batchCode}`}
                className="rounded-full p-xs text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {availableBatches.length > 0 ? (
        <form onSubmit={handleAssign} className="flex flex-col gap-sm sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="batchId">
              Batch
            </label>
            <select
              id="batchId"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            >
              {availableBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code} — {batch.programName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-xs">
            <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="roleLabel">
              Role label (optional)
            </label>
            <input
              id="roleLabel"
              type="text"
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Lead Instructor"
              className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Assign
          </button>
        </form>
      ) : (
        <p className="font-label-sm text-label-sm text-on-surface-variant">Assigned to every batch already.</p>
      )}

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
    </div>
  );
}
