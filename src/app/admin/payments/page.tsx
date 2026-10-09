import Link from "next/link";
import { Search, Download, Wallet, CircleCheck, Clock, Undo2, TrendingUp, TrendingDown } from "lucide-react";
import type { PaymentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import {
  getPaymentStats,
  getPaymentsForAdmin,
  PAYMENT_RANGE_DAYS,
  type PaymentRangeDays,
} from "@/lib/queries/payments";
import { formatDate, formatMoney } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { PaymentStatusPill, PAYMENT_STATUS_EDGE } from "./payment-status";

const STATUS_TABS: { value: PaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const DEFAULT_RANGE: PaymentRangeDays = 30;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; status?: string; search?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const range: PaymentRangeDays = PAYMENT_RANGE_DAYS.find((days) => String(days) === params.range) ?? DEFAULT_RANGE;
  const status: PaymentStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as PaymentStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const [stats, rows] = await Promise.all([getPaymentStats(range), getPaymentsForAdmin({ status, search })]);

  function href(next: { range?: PaymentRangeDays; status?: PaymentStatus | "all" }, base = "/admin/payments"): string {
    const query = new URLSearchParams();
    const nextRange = next.range ?? range;
    const nextStatus = next.status ?? status;
    if (nextRange !== DEFAULT_RANGE) query.set("range", String(nextRange));
    if (nextStatus !== "all") query.set("status", nextStatus);
    if (search) query.set("search", search);
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  }

  const change = stats.revenueChangePercent;

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex flex-col gap-sm">
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
            Payments
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            Monitor program purchases and payment activity.
          </p>
        </div>
        <a
          href={href({}, "/admin/payments/export")}
          className={buttonVariants({ variant: "default", className: "rounded-full" })}
        >
          <Download className="h-4 w-4" /> Export Data
        </a>
      </header>

      <section className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Overview</h2>
          <div className="flex gap-xs rounded-lg bg-surface-container p-xs">
            {PAYMENT_RANGE_DAYS.map((days) => (
              <Link
                key={days}
                href={href({ range: days })}
                aria-current={range === days ? "true" : undefined}
                className={`rounded-md px-md py-sm font-label-md text-label-md transition-colors ${
                  range === days
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Last {days} Days
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
            <span className="flex items-center gap-sm font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              <Wallet className="h-4 w-4" /> Total Revenue
            </span>
            <span className="truncate font-headline-lg text-headline-lg text-on-surface">
              {formatMoney(stats.totalRevenue, stats.currency)}
            </span>
            {change !== null ? (
              <span
                className={`flex items-center gap-xs font-label-sm text-label-sm ${change >= 0 ? "text-primary" : "text-error"}`}
              >
                {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {change >= 0 ? "+" : ""}
                {change}% vs previous {range} days
              </span>
            ) : null}
          </div>
          <StatCard icon={<CircleCheck className="h-4 w-4 text-primary" />} label="Successful" value={stats.successfulCount} />
          <StatCard icon={<Clock className="h-4 w-4 text-secondary" />} label="Pending" value={stats.pendingCount} />
          <StatCard icon={<Undo2 className="h-4 w-4 text-error" />} label="Refunds" value={stats.refundCount} />
        </div>
      </section>

      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="flex flex-wrap gap-xs rounded-lg bg-surface-container p-xs">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={href({ status: tab.value })}
                aria-current={status === tab.value ? "true" : undefined}
                className={`rounded-md px-md py-sm font-label-md text-label-md transition-colors ${
                  status === tab.value
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <form method="GET" action="/admin/payments" className="w-full sm:w-auto">
            {range !== DEFAULT_RANGE ? <input type="hidden" name="range" value={range} /> : null}
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search learner, order ID..."
                aria-label="Search payments"
                className="w-full rounded-lg border border-outline-variant bg-surface py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-80"
              />
            </div>
          </form>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {search ? `No payments match "${search}".` : "No payments match this filter."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                    {["Transaction", "Learner", "Program", "Amount", "Method", "Date", "Status"].map((heading) => (
                      <th
                        key={heading}
                        className={`p-md font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant ${heading === "Amount" ? "text-right" : ""}`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low">
                      <td className="p-md">
                        <Link
                          href={`/admin/payments/${row.id}`}
                          className="whitespace-nowrap font-label-md text-label-md text-on-surface hover:text-primary hover:underline"
                        >
                          {row.transactionRef}
                        </Link>
                      </td>
                      <td className="p-md">
                        <div className="flex items-center gap-sm">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-label-sm text-label-sm text-on-primary">
                            {initials(row.learnerName)}
                          </span>
                          <span className="font-body-md text-body-md text-on-surface">{row.learnerName}</span>
                        </div>
                      </td>
                      <td className="p-md font-body-md text-body-md text-on-surface-variant">{row.programName ?? "—"}</td>
                      <td className="p-md text-right font-label-md text-label-md text-on-surface">
                        {formatMoney(row.amount, row.currency)}
                      </td>
                      <td className="p-md font-label-md text-label-md text-on-surface-variant">{row.method}</td>
                      <td className="whitespace-nowrap p-md font-label-md text-label-md text-on-surface-variant">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="p-md">
                        <PaymentStatusPill status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-outline-variant/40 p-md font-label-sm text-label-sm text-on-surface-variant">
                Showing {rows.length} transaction{rows.length === 1 ? "" : "s"}
              </p>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col gap-md md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/payments/${row.id}`}
                    className={`flex flex-col gap-sm rounded-xl border-l-4 bg-surface-container-lowest p-md shadow-sm ${PAYMENT_STATUS_EDGE[row.status]}`}
                  >
                    <div className="flex items-start justify-between gap-md">
                      <div className="min-w-0">
                        <p className="truncate font-body-md text-body-md text-on-surface">{row.learnerName}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant">{row.transactionRef}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-xs">
                        <span className="font-body-md text-body-md text-on-surface">
                          {formatMoney(row.amount, row.currency)}
                        </span>
                        <PaymentStatusPill status={row.status} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-md font-label-md text-label-md text-on-surface-variant">
                      <span className="truncate">{row.programName ?? "—"}</span>
                      <span className="shrink-0">{formatDate(row.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
      <span className="flex items-center gap-sm font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
        {icon} {label}
      </span>
      <span className="font-headline-lg text-headline-lg text-on-surface">{value}</span>
    </div>
  );
}
