"use client"; // reason textarea + confirm step + pending submit

import { useState, useTransition } from "react";
import { revokeCertificate } from "./actions";

export function RevokeForm({ certificateId }: { certificateId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await revokeCertificate(certificateId, { reason });
      if (!result.ok) setError(result.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-error-container px-lg py-sm font-label-md text-label-md text-on-error-container transition-opacity hover:opacity-90"
      >
        Revoke Certificate
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-sm rounded-xl border border-error/30 bg-error-container/20 p-lg">
      <label className="font-label-md text-label-md text-on-surface" htmlFor="reason">
        Reason for revocation
      </label>
      <textarea
        id="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        rows={3}
        className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
      <div className="flex gap-sm">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-error px-lg py-sm font-label-md text-label-md text-on-error transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Revoking..." : "Confirm Revoke"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
