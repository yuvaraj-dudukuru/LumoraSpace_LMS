"use client"; // checkbox selection state + the bulk-grant action bar live here

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AdminEnrollmentRow } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { EnrollmentRowActions } from "./enrollment-row-actions";
import { bulkGrantAccess } from "./actions";

const ACCESS_STATE_STYLES: Record<string, string> = {
  GRANTED: "bg-success-container text-success",
  SUSPENDED: "bg-error-container text-on-error-container",
  AWAITING: "bg-warning-container text-warning",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-primary-container text-on-primary-container",
  COMPLETED: "bg-success-container text-success",
  PENDING: "bg-surface-container-high text-on-surface-variant",
  CANCELLED: "bg-surface-container-high text-on-surface-variant",
  DROPPED: "bg-surface-container-high text-on-surface-variant",
};

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
    <div className="flex flex-col gap-md">
      {selectedAwaitingCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-md rounded-xl bg-primary-container p-md">
          <span className="font-label-md text-label-md text-on-primary-container">
            {selectedAwaitingCount} selected
          </span>
          <div className="flex items-center gap-md">
            {message ? <span className="font-label-sm text-label-sm text-on-primary-container">{message}</span> : null}
            <button
              type="button"
              disabled={isPending}
              onClick={handleBulkGrant}
              className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Grant Access to Selected
            </button>
          </div>
        </div>
      ) : message ? (
        <p className="font-label-sm text-label-sm text-on-surface-variant">{message}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-outline-variant/40">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-low">
              <th className="w-12 p-md">
                <input
                  type="checkbox"
                  checked={awaitingIds.length > 0 && selected.size === awaitingIds.length}
                  onChange={toggleAll}
                  disabled={awaitingIds.length === 0}
                  aria-label="Select all AWAITING enrollments"
                />
              </th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Learner</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Program / Batch</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Enrolled</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Access</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Progress</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Status</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-outline-variant/20 last:border-0">
                <td className="p-md align-top">
                  {row.accessState === "AWAITING" ? (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.learnerName}`}
                    />
                  ) : null}
                </td>
                <td className="p-md align-top">
                  <Link href={`/admin/users`} className="font-label-md text-label-md text-on-surface hover:underline">
                    {row.learnerName}
                  </Link>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{row.learnerEmail}</p>
                </td>
                <td className="p-md align-top">
                  <p className="font-label-md text-label-md text-on-surface">{row.programName}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{row.batchName ?? "—"}</p>
                </td>
                <td className="p-md align-top font-label-sm text-label-sm text-on-surface-variant">
                  {formatDate(row.enrolledAt)}
                </td>
                <td className="p-md align-top">
                  <span
                    className={`rounded-full px-md py-xs font-label-sm text-label-sm ${ACCESS_STATE_STYLES[row.accessState] ?? ""}`}
                  >
                    {row.accessState}
                  </span>
                </td>
                <td className="p-md align-top">
                  <div className="flex w-24 flex-col gap-xs">
                    <span className="font-label-sm text-label-sm text-on-surface">{row.progressPercent}%</span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${row.progressPercent}%` }} />
                    </div>
                  </div>
                </td>
                <td className="p-md align-top">
                  <span
                    className={`rounded-full px-md py-xs font-label-sm text-label-sm ${STATUS_STYLES[row.status] ?? ""}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="p-md align-top">
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
