"use client"; // open/closed state, Escape to close, pending submit, server error display

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { FormAction } from "@/lib/action-result";

const TRIGGER_STYLE = {
  primary:
    "inline-flex items-center justify-center gap-sm rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90",
  outline:
    "inline-flex items-center justify-center gap-sm rounded-lg border border-outline bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container",
  link: "inline-flex items-center gap-xs font-label-md text-label-md text-primary hover:underline",
  icon: "inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface",
} as const;

/** A button that opens a dialog containing a form. The fields are whatever
 * the (server) caller passes as children — uncontrolled inputs with `name`s
 * — and `action` is a Server Action taking the FormData. On `{ ok: true }`
 * the dialog closes and the route refreshes (or follows `redirectTo`); on
 * `{ ok: false }` the error is shown and what was typed is kept. */
export function ModalForm({
  trigger,
  triggerVariant = "primary",
  triggerLabel,
  title,
  description,
  submitLabel,
  pendingLabel = "Saving...",
  action,
  children,
}: {
  trigger: React.ReactNode;
  triggerVariant?: keyof typeof TRIGGER_STYLE;
  /** Accessible name when `trigger` is only an icon. */
  triggerLabel?: string;
  title: string;
  description?: string;
  submitLabel: string;
  pendingLabel?: string;
  action: FormAction;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    // Focus the first field so keyboard users land inside the dialog.
    dialogRef.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (result.redirectTo) router.push(result.redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={TRIGGER_STYLE[triggerVariant]}
      >
        {trigger}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-md sm:items-center">
          <button
            type="button"
            aria-label="Close dialog"
            tabIndex={-1}
            className="fixed inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex w-full max-w-xl flex-col gap-lg rounded-2xl bg-surface-container-lowest p-xl shadow-xl"
          >
            <div className="flex items-start justify-between gap-md">
              <div className="flex flex-col gap-xs">
                <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface">
                  {title}
                </h2>
                {description ? (
                  <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-md">
              {children}
              {error ? (
                <p role="alert" className="rounded-lg bg-error-container px-md py-sm font-label-md text-label-md text-on-error-container">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-sm pt-sm">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-lg py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? pendingLabel : submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
