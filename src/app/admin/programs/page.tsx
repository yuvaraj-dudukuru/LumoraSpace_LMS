import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { ModalForm } from "@/components/admin/modal-form";
import { PageHeader } from "@/components/admin/ui";
import { ProgramFields } from "./program-fields";
import { createProgram } from "./actions";
import type { ContentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getProgramsForAdmin } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { ProgramStatusPill } from "./program-status";

const STATUS_TABS: { value: ContentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const status: ContentStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as ContentStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const { counts, rows } = await getProgramsForAdmin({ status, search });

  function tabHref(next: ContentStatus | "all"): string {
    const query = new URLSearchParams();
    if (next !== "all") query.set("status", next);
    if (search) query.set("search", search);
    const qs = query.toString();
    return qs ? `/admin/programs?${qs}` : "/admin/programs";
  }

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Programs" description="Create and manage the learning programs offered through LumoraSpace.">
        <ModalForm
          trigger={
            <>
              <Plus className="h-4 w-4" /> Create Program
            </>
          }
          title="Create Program"
          description="Starts as a draft. Add its curriculum, then publish it."
          submitLabel="Create Program"
          pendingLabel="Creating..."
          action={createProgram}
        >
          <ProgramFields />
        </ModalForm>
      </PageHeader>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
        <StatCard label="Total Programs" value={counts.total} />
        <StatCard label="Published" value={counts.published} />
        <StatCard label="Draft" value={counts.draft} />
      </div>

      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <form method="GET" action="/admin/programs" className="w-full sm:w-auto">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search programs..."
                aria-label="Search programs"
                className="w-full rounded-lg border border-outline-variant bg-surface py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-80"
              />
            </div>
          </form>

          <div className="flex flex-wrap gap-xs rounded-lg bg-surface-container p-xs">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tabHref(tab.value)}
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
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {search ? `No programs match "${search}".` : "No programs match this filter."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl bg-surface-container-low lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container">
                    <th className="p-lg font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Program</th>
                    <th className="p-lg font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Status</th>
                    <th className="p-lg text-right font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Curriculum</th>
                    <th className="p-lg text-right font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Batches</th>
                    <th className="p-lg text-right font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Enrollments</th>
                    <th className="p-lg text-right font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Updated</th>
                    <th className="p-lg">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-outline-variant/30 last:border-0">
                      {/* w-full + max-w-0: takes the leftover width and truncates instead of widening the table */}
                      <td className="w-full min-w-56 max-w-0 p-lg">
                        <p className="truncate font-title-lg text-title-lg text-on-surface">{row.name}</p>
                        <p className="truncate font-body-md text-body-md text-on-surface-variant">{row.description}</p>
                      </td>
                      <td className="p-lg">
                        <ProgramStatusPill status={row.status} />
                      </td>
                      <td className="whitespace-nowrap p-lg text-right font-body-md text-body-md text-on-surface">
                        {row.moduleCount} Module{row.moduleCount === 1 ? "" : "s"}
                      </td>
                      <td className="whitespace-nowrap p-lg text-right font-body-md text-body-md text-on-surface">
                        {row.activeBatchCount > 0 ? `${row.activeBatchCount} Active` : "-"}
                      </td>
                      <td className="p-lg text-right font-body-md text-body-md text-on-surface">
                        {row.enrollmentCount > 0 ? (
                          <span className="inline-flex items-center gap-xs">
                            <Users className="h-4 w-4 text-on-surface-variant" /> {row.enrollmentCount}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="whitespace-nowrap p-lg text-right font-body-md text-body-md text-on-surface-variant">
                        {formatDate(row.updatedAt)}
                      </td>
                      <td className="p-lg text-right">
                        <Link
                          href={`/admin/programs/${row.id}`}
                          className="font-label-md text-label-md text-primary hover:underline"
                          aria-label={`View ${row.name}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-outline-variant/40 bg-surface-container p-lg font-body-md text-body-md text-on-surface-variant">
                Showing {rows.length} of {counts.total} program{counts.total === 1 ? "" : "s"}
              </p>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col gap-md lg:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/programs/${row.id}`}
                    className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg"
                  >
                    <div className="flex items-start justify-between gap-md">
                      <p className="font-title-lg text-title-lg text-on-surface">{row.name}</p>
                      <ProgramStatusPill status={row.status} />
                    </div>
                    <dl className="grid grid-cols-3 divide-x divide-outline-variant/40 border-t border-outline-variant/40 pt-md">
                      <CardStat label="Modules" value={row.moduleCount} />
                      <CardStat label="Batches" value={row.activeBatchCount} padded />
                      <CardStat label="Learners" value={row.enrollmentCount} padded />
                    </dl>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-sm rounded-2xl bg-surface-container p-lg">
      <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">{label}</span>
      <span className="font-display-lg-mobile text-display-lg-mobile text-on-surface">{value}</span>
    </div>
  );
}

function CardStat({ label, value, padded = false }: { label: string; value: number; padded?: boolean }) {
  return (
    <div className={`flex flex-col gap-xs ${padded ? "pl-md" : ""}`}>
      <dt className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="font-body-lg text-body-lg text-on-surface">{value}</dd>
    </div>
  );
}
