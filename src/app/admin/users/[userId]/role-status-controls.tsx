"use client"; // each control has its own pending transition + inline server error (e.g. self-lockout)

import { useState, useTransition } from "react";
import { updateUserRole, setUserStatus } from "../actions";

export function RoleStatusControls({
  userId,
  role,
  status,
}: {
  userId: string;
  role: string;
  status: string;
}) {
  const [rolePending, startRoleTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [roleError, setRoleError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  function handleRoleChange(newRole: string): void {
    setRoleError(null);
    startRoleTransition(async () => {
      const result = await updateUserRole(userId, { role: newRole });
      if (!result.ok) setRoleError(result.error);
    });
  }

  function handleStatusToggle(): void {
    setStatusError(null);
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    startStatusTransition(async () => {
      const result = await setUserStatus(userId, { status: newStatus });
      if (!result.ok) setStatusError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-lg sm:flex-row sm:gap-2xl">
      <div className="flex flex-col gap-xs">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Role</span>
        <select
          defaultValue={role}
          disabled={rolePending}
          onChange={(e) => handleRoleChange(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="LEARNER">Learner</option>
          <option value="MENTOR">Mentor</option>
          <option value="ADMIN">Admin</option>
        </select>
        {roleError ? <p className="font-label-sm text-label-sm text-error">{roleError}</p> : null}
      </div>

      <div className="flex flex-col gap-xs">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Status</span>
        <button
          type="button"
          disabled={statusPending}
          onClick={handleStatusToggle}
          className={`rounded-full px-lg py-sm font-label-md text-label-md transition-opacity hover:opacity-90 disabled:opacity-50 ${
            status === "ACTIVE" ? "bg-error-container text-on-error-container" : "bg-success-container text-success"
          }`}
        >
          {status === "ACTIVE" ? "Deactivate" : "Reactivate"}
        </button>
        {statusError ? <p className="font-label-sm text-label-sm text-error">{statusError}</p> : null}
      </div>
    </div>
  );
}
