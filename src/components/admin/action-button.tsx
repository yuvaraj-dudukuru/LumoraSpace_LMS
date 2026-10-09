"use client"; // pending state, optional confirm step, inline error

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

const STYLE = {
  primary:
    "inline-flex items-center justify-center gap-sm rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50",
  outline:
    "inline-flex items-center justify-center gap-sm rounded-lg border border-outline bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-sm rounded-lg border border-error/40 bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-error transition-colors hover:bg-error-container/40 disabled:opacity-50",
  link: "inline-flex items-center gap-xs font-label-md text-label-md text-primary hover:underline disabled:opacity-50",
  dangerLink: "inline-flex items-center gap-xs font-label-md text-label-md text-error hover:underline disabled:opacity-50",
  icon: "inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-30",
} as const;

/** One click → one Server Action (already bound to its ids by the server
 * page). With `confirm`, the first click swaps the button for the question
 * and a Confirm/Cancel pair — used for anything that deletes or is hard to
 * undo. The error, if any, is shown beside the button. */
export function ActionButton({
  action,
  children,
  variant = "outline",
  label,
  pendingLabel,
  confirm,
  confirmLabel = "Confirm",
  disabled = false,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: keyof typeof STYLE;
  /** Accessible name when the content is only an icon. */
  label?: string;
  pendingLabel?: string;
  /** Question to ask before running, e.g. "Delete this lesson?". */
  confirm?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        setAsking(false);
        return;
      }
      setAsking(false);
      if (result.redirectTo) router.push(result.redirectTo);
      else router.refresh();
    });
  }

  if (asking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-sm rounded-lg bg-error-container/40 px-md py-sm">
        <span className="font-label-md text-label-md text-on-surface">{confirm}</span>
        <button type="button" disabled={isPending} onClick={run} className={STYLE.dangerLink}>
          {isPending ? (pendingLabel ?? "Working...") : confirmLabel}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setAsking(false)}
          className="font-label-md text-label-md text-on-surface-variant hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-sm">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled || isPending}
        onClick={() => (confirm ? setAsking(true) : run())}
        className={STYLE[variant]}
      >
        {isPending && pendingLabel ? pendingLabel : children}
      </button>
      {error ? (
        <span role="alert" className="font-label-sm text-label-sm text-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
