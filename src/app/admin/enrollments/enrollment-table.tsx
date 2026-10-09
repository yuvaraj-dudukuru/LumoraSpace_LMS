"use client"; // checkbox selection state + the bulk-grant action bar live here

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AdminEnrollmentRow } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { ACCESS_STATE, ENROLLMENT_STATUS } from "@/components/admin/status";
import { Avatar, ProgressBar, StatusPill, TH } from "@/components/admin/ui";
import { EnrollmentRowActions } from "./enrollment-row-actions";
import { bulkGrantAccess } from "./actions";

export function EnrollmentTable({ rows }: { rows: AdminEnrollmentRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const awaitingIds = rows.filter((row) => row.accessState === "AWAITING").map((row) => row.id);
  const selectedAwaitingCount = [...selected].filter((id) => awaitingIds.includes(id)).length;

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    setSelected((prev) => (prev.size === awaitingIds.length ? new Set() : new Set(awaitingIds)));
  }

  function handleBulkGrant(): void {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkGrantAccess([...selected]);
      if (result.ok) {
        setMessage(`Granted access to ${result.grantedCount} learner${result.grantedCount === 1 ? "" : "s"}.`);
        setSelected(new Set());
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col">
      {selectedAwaitingCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-md bg-primary-container p-md">
          <span className="font-label-md text-label-md text-on-primary-container">{selectedAwaitingCount} selected</span>
          <div className="flex items-center gap-md">
            {message ? <span className="font-label-sm text-label-sm text-on-primary-container">{message}</span> : null}
            <button
              type="button"
              disabled={isPending}
              onClick={handleBulkGrant}
              className="rounded-full bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Grant Access to Selected
            </button>
          </div>
        </div>
      ) : message ? (
        <p role="status" className="p-md font-label-md text-label-md text-on-surface-variant">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-low">
              <th className="w-12 p-md">
                <input
                  type="checkbox"
                  checked={awaitingIds.length > 0 && selected.size === awaitingIds.length}
                  onChange={toggleAll}
                  disabled={awaitingIds.length === 0}
                  aria-label="Select all enrollments awaiting access"
                  className="h-4 w-4 accent-primary"
                />
              </th>
              <th className={TH}>Learner</th>
              <th className={TH}>Program &amp; Batch</th>
              <th className={TH}>Enrolled</th>
              <th className={TH}>Access</th>
              <th className={TH}>Progress</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-outline-variant/20 last:border-0">
                <td className="p-md">
                  {row.accessState === "AWAITING" ? (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.learnerName}`}
                      className="h-4 w-4 accent-primary"
                    />
                  ) : null}
                </td>
                <td className="p-md">
                  <div className="flex items-center gap-md">
                    <Avatar name={row.learnerName} />
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/admin/users/${row.userId}`}
                        className="truncate font-body-md text-body-md text-on-surface hover:text-primary hover:underline"
                      >
                        {row.learnerName}
                      </Link>
                      <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{row.learnerEmail}</span>
                    </div>
                  </div>
                </td>
                <td className="min-w-44 p-md">
                  <p className="font-body-md text-body-md text-on-surface">{row.programName}</p>
                  {row.batchName ? (
                    <span className="mt-xs inline-block whitespace-nowrap rounded bg-surface-container px-sm py-xs font-mono font-label-sm text-label-sm text-on-surface-variant">
                      {row.batchName}
                      {row.batchCode ? ` · ${row.batchCode}` : ""}
                    </span>
                  ) : (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">No batch</span>
                  )}
                </td>
                <td className="whitespace-nowrap p-md font-body-md text-body-md text-on-surface-variant">
                  {formatDate(row.enrolledAt)}
                </td>
                <td className="p-md">
                  <StatusPill tone={ACCESS_STATE[row.accessState].tone}>{ACCESS_STATE[row.accessState].label}</StatusPill>
                </td>
                <td className="p-md">
                  <div className="flex w-24 items-center gap-sm">
                    <ProgressBar percent={row.progressPercent} label={`${row.learnerName} progress`} />
                    <span className="w-10 shrink-0 text-right font-label-md text-label-md text-on-surface">
                      {Math.round(row.progressPercent)}%
                    </span>
                  </div>
                </td>
                <td className="p-md">
                  <StatusPill tone={ENROLLMENT_STATUS[row.status].tone} dot={false}>
                    {ENROLLMENT_STATUS[row.status].label}
                  </StatusPill>
                </td>
                <td className="p-md">
                  <EnrollmentRowActions enrollmentId={row.id} accessState={row.accessState} status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
