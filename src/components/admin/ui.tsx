import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

/** Shared, server-renderable pieces of the admin screens (design/stitch
 * `*_lumoraspace_admin`). Anything interactive lives in the client files
 * next to this one (modal-form.tsx, action-button.tsx). */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  /** Right-aligned actions. */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-md">
      <div className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-sm">{children}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  /** Small line under the value (a trend, a caption). */
  hint?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-sm font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
        {label}
        {icon}
      </span>
      <span className="truncate font-headline-lg text-headline-lg text-on-surface">{value}</span>
      {hint ? <span className="font-label-sm text-label-sm text-on-surface-variant">{hint}</span> : null}
    </>
  );
  const className = "flex flex-col gap-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-surface-container-low`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export type TabItem = { label: string; href: string; active: boolean; count?: number };

/** `pill` = the rounded chips (batches, users); `segment` = the grey track
 * with a white active segment (payments, programs, mentors). */
export function FilterTabs({ tabs, variant = "pill", label }: { tabs: TabItem[]; variant?: "pill" | "segment"; label: string }) {
  if (variant === "segment") {
    return (
      <nav aria-label={label} className="flex flex-wrap gap-xs rounded-lg bg-surface-container p-xs">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "true" : undefined}
            className={`rounded-md px-md py-sm font-label-md text-label-md transition-colors ${
              tab.active
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label={label} className="flex flex-wrap gap-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "true" : undefined}
          className={`flex items-center gap-sm rounded-full border px-lg py-sm font-label-md text-label-md transition-colors ${
            tab.active
              ? "border-primary-container bg-primary-container text-on-primary"
              : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container"
          }`}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span
              className={`rounded-full px-sm font-label-sm text-label-sm ${tab.active ? "bg-surface-container-lowest text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
            >
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** A GET form: submitting navigates to `action?search=…` plus the hidden
 * params (the filters already chosen), so search composes with the tabs. */
export function SearchForm({
  action,
  placeholder,
  defaultValue,
  hidden = {},
  name = "search",
}: {
  action: string;
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
  name?: string;
}) {
  return (
    <form method="GET" action={action} role="search" className="w-full sm:w-auto">
      {Object.entries(hidden).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="search"
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-80"
        />
      </div>
    </form>
  );
}

/** GET-form select that submits on its own button-less change is a client
 * concern; this stays server-only: a labelled select + "Apply" inside a form. */
export function FilterSelect({
  action,
  name,
  label,
  value,
  options,
  hidden = {},
}: {
  action: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form method="GET" action={action} className="flex items-center gap-sm">
      {Object.entries(hidden).map(([key, hiddenValue]) =>
        hiddenValue ? <input key={key} type="hidden" name={key} value={hiddenValue} /> : null,
      )}
      <label className="flex items-center gap-sm font-label-md text-label-md text-on-surface-variant">
        {label}
        <select
          name={name}
          defaultValue={value}
          className="rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm font-label-md text-label-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
      >
        Apply
      </button>
    </form>
  );
}

export function Pagination({
  from,
  to,
  total,
  page,
  pageCount,
  noun,
  hrefFor,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pageCount: number;
  /** Plural noun for the count line, e.g. "users". */
  noun: string;
  hrefFor: (page: number) => string;
}) {
  const arrow = "flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/60";
  return (
    <div className="flex flex-wrap items-center justify-between gap-md border-t border-outline-variant/40 p-md">
      <p className="font-label-md text-label-md text-on-surface-variant">
        {total === 0 ? `No ${noun}` : `Showing ${from}-${to} of ${total} ${noun}`}
      </p>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-sm">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} aria-label="Previous page" className={`${arrow} text-on-surface hover:bg-surface-container`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${arrow} text-outline-variant`}>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
          <span className="font-label-md text-label-md text-on-surface-variant">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} aria-label="Next page" className={`${arrow} text-on-surface hover:bg-surface-container`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${arrow} text-outline-variant`}>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

const AVATAR_SIZE = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" } as const;

/** Initials only — there is no avatar upload, and User.avatarUrl is never set. */
export function Avatar({ name, size = "md", className = "" }: { name: string; size?: keyof typeof AVATAR_SIZE; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-container font-label-sm text-label-sm text-on-primary ${AVATAR_SIZE[size]} ${className}`}
    >
      {initials}
    </span>
  );
}

export type PillTone = "primary" | "secondary" | "success" | "warning" | "error" | "neutral";

const PILL_TONE: Record<PillTone, { pill: string; dot: string }> = {
  primary: { pill: "bg-primary-fixed text-primary", dot: "bg-primary" },
  secondary: { pill: "bg-secondary-fixed text-secondary", dot: "bg-secondary" },
  success: { pill: "bg-success-container text-success", dot: "bg-success" },
  warning: { pill: "bg-warning-container text-warning", dot: "bg-warning" },
  error: { pill: "bg-error-container text-on-error-container", dot: "bg-error" },
  neutral: { pill: "bg-surface-container-high text-on-surface-variant", dot: "bg-outline" },
};

export function StatusPill({ tone, dot = true, children }: { tone: PillTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-xs whitespace-nowrap rounded-full px-sm py-xs font-label-sm text-label-sm ${PILL_TONE[tone].pill}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${PILL_TONE[tone].dot}`} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function EmptyState({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-md rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
      {icon}
      <p className="max-w-md font-body-md text-body-md text-on-surface-variant">{children}</p>
    </div>
  );
}

/** White rounded panel used for tables and detail cards. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-outline-variant/40 bg-surface-container-lowest ${className}`}>
      {children}
    </section>
  );
}

export function ProgressBar({ percent, label, tone = "bg-primary-container" }: { percent: number; label: string; tone?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest"
    >
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export const TH = "p-md font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant";
export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-sm rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50";
export const OUTLINE_BUTTON =
  "inline-flex items-center justify-center gap-sm rounded-lg border border-outline bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50";
export const DANGER_BUTTON =
  "inline-flex items-center justify-center gap-sm rounded-lg bg-error px-lg py-sm font-label-md text-label-md text-on-error transition-opacity hover:opacity-90 disabled:opacity-50";
export const LINK_BUTTON = "font-label-md text-label-md text-primary hover:underline disabled:opacity-50";
