"use client"; // reason textarea + confirm step + pending submit

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { refundPayment } from "./actions";

export function RefundForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await refundPayment(paymentId, { reason });
      if (!result.ok) setError(result.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-sm rounded-lg border border-outline bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container sm:w-auto"
      >
        <Undo2 className="h-4 w-4" /> Refund Payment
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-sm rounded-xl border border-error/30 bg-error-container/20 p-lg sm:max-w-md"
    >
      <label className="font-label-md text-label-md text-on-surface" htmlFor="refund-reason">
        Reason for refund
      </label>
      <textarea
        id="refund-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        maxLength={300}
        rows={3}
        className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
      />
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        This marks the payment as refunded in LumoraSpace. It does not send money back or change the learner&apos;s
        access.
      </p>
      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
      <div className="flex gap-sm">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-error px-lg py-sm font-label-md text-label-md text-on-error transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Refunding..." : "Confirm Refund"}
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
