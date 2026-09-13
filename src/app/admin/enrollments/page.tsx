import Link from "next/link";
import { Search } from "lucide-react";
import type { AccessState, EnrollmentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getEnrollmentsForAdmin } from "@/lib/queries/admin";
import { EnrollmentTable } from "./enrollment-table";

const ACCESS_TABS: { value: AccessState | "all"; label: string }[] = [
  { value: "AWAITING", label: "Awaiting" },
  { value: "GRANTED", label: "Granted" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "all", label: "All" },
];

const STATUS_TABS: { value: EnrollmentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "DROPPED", label: "Dropped" },
];

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ accessState?: string; status?: string; search?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  // Default view (no query params at all) shows AWAITING first — that's the
  // queue an admin actually works. Once any filter is explicitly chosen
  // (including "All"), respect it as given.
  const accessState: AccessState | "all" = ACCESS_TABS.some((tab) => tab.value === params.accessState)
    ? (params.accessState as AccessState | "all")
    : params.status || params.search
      ? "all"
      : "AWAITING";
  const status: EnrollmentStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as EnrollmentStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const rows = await getEnrollmentsForAdmin({ accessState, status, search });

  function tabHref(nextAccessState?: AccessState | "all", nextStatus?: EnrollmentStatus | "all"): string {
    const query = new URLSearchParams();
    const a = nextAccessState ?? accessState;
    const s = nextStatus ?? status;
    if (a !== "all") query.set("accessState", a);
    if (s !== "all") query.set("status", s);
    if (search) query.set("search", search);
    const qs = query.toString();
    return qs ? `/admin/enrollments?${qs}` : "/admin/enrollments";
  }

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Enrollments
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Grant access, suspend, and manage learner enrollment status.
        </p>
      </header>

      <div className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="flex flex-wrap gap-sm">
            {ACCESS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tabHref(tab.value, undefined)}
                className={`rounded-full px-lg py-sm font-label-md text-label-md transition-colors ${
                  accessState === tab.value
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <form method="GET" action="/admin/enrollments" className="flex items-center gap-sm">
            {accessState !== "all" ? <input type="hidden" name="accessState" value={accessState} /> : null}
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search learner name or email..."
                className="w-full rounded-lg border border-outline-variant bg-surface py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-72"
              />
            </div>
          </form>
        </div>

        <div className="flex flex-wrap gap-sm">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tabHref(undefined, tab.value)}
              className={`rounded-full px-md py-xs font-label-sm text-label-sm transition-colors ${
                status === tab.value
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {search ? `No enrollments match "${search}".` : "No enrollments match this filter."}
          </p>
        </div>
      ) : (
        <EnrollmentTable rows={rows} />
      )}
    </div>
  );
}
