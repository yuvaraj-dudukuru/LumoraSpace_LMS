import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import type { BatchStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getBatchesForAdmin } from "@/lib/queries/admin-batches";
import { getProgramOptions } from "@/lib/queries/admin-options";
import { buildHref, paginate } from "@/lib/pagination";
import { ModalForm } from "@/components/admin/modal-form";
import { BATCH_STATUS, formatDateRange } from "@/components/admin/status";
import {
  Avatar,
  EmptyState,
  FilterTabs,
  PageHeader,
  Pagination,
  Panel,
  SearchForm,
  StatCard,
  StatusPill,
  TH,
} from "@/components/admin/ui";
import { BatchFields } from "./batch-fields";
import { createBatch } from "./actions";

const STATUS_TABS: { value: BatchStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];

const MENTOR_AVATAR_LIMIT = 3;

export default async function AdminBatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status: BatchStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as BatchStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const [{ counts, rows }, programOptions] = await Promise.all([
    getBatchesForAdmin({ status, search }),
    getProgramOptions(),
  ]);
  const page = paginate(rows, params.page);
  const href = (next: { status?: BatchStatus | "all"; page?: number }) =>
    buildHref("/admin/batches", { status: next.status ?? status, search, page: next.page }, { status: "all", page: 1 });

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Batches" description="Organize learners into program cohorts and manage their learning delivery.">
        <ModalForm
          trigger={
            <>
              <Plus className="h-4 w-4" /> Create Batch
            </>
          }
          title="Create Batch"
          description="A dated cohort of one program. It starts as Upcoming."
          submitLabel="Create Batch"
          pendingLabel="Creating..."
          action={createBatch}
        >
          <BatchFields programOptions={programOptions} />
        </ModalForm>
      </PageHeader>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Batches" value={counts.total} />
        <StatCard label="Active" value={counts.active} href={href({ status: "ACTIVE" })} />
        <StatCard label="Upcoming" value={counts.upcoming} href={href({ status: "UPCOMING" })} />
        <StatCard label="Completed" value={counts.completed} href={href({ status: "COMPLETED" })} />
      </div>

      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <FilterTabs
            label="Batch status"
            tabs={STATUS_TABS.map((tab) => ({ label: tab.label, href: href({ status: tab.value }), active: status === tab.value }))}
          />
          <SearchForm
            action="/admin/batches"
            placeholder="Search batches..."
            defaultValue={search}
            hidden={{ status: status === "all" ? undefined : status }}
          />
        </div>

        {page.total === 0 ? (
          <EmptyState icon={<Layers className="h-10 w-10 text-on-surface-variant" />}>
            {search ? `No batches match "${search}".` : "No batches match this filter."}
          </EmptyState>
        ) : (
          <Panel className="overflow-hidden">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                    <th className={TH}>Batch</th>
                    <th className={TH}>Program</th>
                    <th className={TH}>Schedule</th>
                    <th className={`${TH} text-right`}>Learners</th>
                    <th className={TH}>Mentors</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((batch) => (
                    <tr key={batch.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low">
                      <td className="p-md">
                        <Link href={`/admin/batches/${batch.id}`} className="font-title-lg text-title-lg text-on-surface hover:text-primary">
                          {batch.name}
                        </Link>
                        <p className="font-label-md text-label-md text-on-surface-variant">{batch.code}</p>
                      </td>
                      <td className="p-md font-body-md text-body-md text-on-surface">{batch.programName}</td>
                      <td className="whitespace-nowrap p-md font-body-md text-body-md text-on-surface">
                        {formatDateRange(batch.startDate, batch.endDate)}
                      </td>
                      <td className="whitespace-nowrap p-md text-right font-body-md text-body-md text-on-surface">
                        {batch.learnerCount}
                        {batch.capacity !== null ? <span className="text-on-surface-variant"> / {batch.capacity}</span> : null}
                      </td>
                      <td className="p-md">
                        {batch.mentors.length === 0 ? (
                          <span className="font-label-md text-label-md text-error">None assigned</span>
                        ) : (
                          <span className="flex items-center" title={batch.mentors.map((mentor) => mentor.name).join(", ")}>
                            {batch.mentors.slice(0, MENTOR_AVATAR_LIMIT).map((mentor) => (
                              <Avatar key={mentor.id} name={mentor.name} size="sm" className="-ml-xs border-2 border-surface-container-lowest first:ml-0" />
                            ))}
                            {batch.mentors.length > MENTOR_AVATAR_LIMIT ? (
                              <span className="pl-xs font-label-sm text-label-sm text-on-surface-variant">
                                +{batch.mentors.length - MENTOR_AVATAR_LIMIT}
                              </span>
                            ) : null}
                            <span className="sr-only">{batch.mentors.map((mentor) => mentor.name).join(", ")}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-md">
                        <StatusPill tone={BATCH_STATUS[batch.status].tone} dot={false}>
                          {BATCH_STATUS[batch.status].label}
                        </StatusPill>
                      </td>
                      <td className="p-md text-right">
                        <Link
                          href={`/admin/batches/${batch.id}`}
                          aria-label={`View ${batch.name} (${batch.code})`}
                          className="font-label-md text-label-md text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards (batches_mobile) */}
            <ul className="flex flex-col lg:hidden">
              {page.rows.map((batch) => (
                <li key={batch.id} className="border-b border-outline-variant/30 last:border-0">
                  <Link href={`/admin/batches/${batch.id}`} className="flex flex-col gap-sm p-md">
                    <div className="flex items-start justify-between gap-md">
                      <div className="min-w-0">
                        <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{batch.programName}</p>
                        <p className="font-title-lg text-title-lg text-on-surface">
                          {batch.name} <span className="font-label-md text-label-md text-on-surface-variant">· {batch.code}</span>
                        </p>
                      </div>
                      <StatusPill tone={BATCH_STATUS[batch.status].tone} dot={false}>
                        {BATCH_STATUS[batch.status].label}
                      </StatusPill>
                    </div>
                    <p className="font-label-md text-label-md text-on-surface-variant">
                      {formatDateRange(batch.startDate, batch.endDate)}
                    </p>
                    <p className="font-label-md text-label-md text-on-surface-variant">
                      {batch.learnerCount}
                      {batch.capacity !== null ? ` / ${batch.capacity}` : ""} learner{batch.learnerCount === 1 ? "" : "s"} ·{" "}
                      {batch.mentors.length} mentor{batch.mentors.length === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination {...page} noun="batches" hrefFor={(next) => href({ page: next })} />
          </Panel>
        )}
      </section>
    </div>
  );
}
