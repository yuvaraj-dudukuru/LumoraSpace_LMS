import { CircleCheck, CircleX, ClipboardList, Plus, UserCheck, Users } from "lucide-react";
import type { AccessState, EnrollmentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getEnrollmentCounts, getEnrollmentsForAdmin } from "@/lib/queries/admin";
import { getLearnerOptions, getOpenBatchOptions } from "@/lib/queries/admin-options";
import { buildHref, paginate } from "@/lib/pagination";
import { ModalForm } from "@/components/admin/modal-form";
import { CheckboxField, SelectField } from "@/components/admin/fields";
import { EmptyState, FilterTabs, PageHeader, Pagination, Panel, SearchForm, StatCard } from "@/components/admin/ui";
import { EnrollmentTable } from "./enrollment-table";
import { createEnrollment } from "./actions";

// One "Cancelled" tab covers CANCELLED and DROPPED (getEnrollmentsForAdmin).
const STATUS_TABS: { value: EnrollmentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ACCESS_TABS: { value: AccessState | "all"; label: string }[] = [
  { value: "all", label: "Any access" },
  { value: "AWAITING", label: "Awaiting" },
  { value: "GRANTED", label: "Granted" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ accessState?: string; status?: string; search?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const accessState: AccessState | "all" = ACCESS_TABS.some((tab) => tab.value === params.accessState)
    ? (params.accessState as AccessState | "all")
    : "all";
  const status: EnrollmentStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as EnrollmentStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const [counts, rows, learnerOptions, batchOptions] = await Promise.all([
    getEnrollmentCounts(),
    getEnrollmentsForAdmin({ accessState, status, search }),
    getLearnerOptions(),
    getOpenBatchOptions(),
  ]);
  const page = paginate(rows, params.page);

  const href = (next: { accessState?: AccessState | "all"; status?: EnrollmentStatus | "all"; page?: number }) =>
    buildHref(
      "/admin/enrollments",
      { accessState: next.accessState ?? accessState, status: next.status ?? status, search, page: next.page },
      { accessState: "all", status: "all", page: 1 },
    );

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Enrollments" description="Manage learner access to LumoraSpace programs and batches.">
        <ModalForm
          trigger={
            <>
              <Plus className="h-4 w-4" /> Create Enrollment
            </>
          }
          title="Create Enrollment"
          description="Place a learner into an upcoming or active batch."
          submitLabel="Create Enrollment"
          pendingLabel="Creating..."
          action={createEnrollment}
        >
          <SelectField name="userId" label="Learner" required placeholder="Select a learner" options={learnerOptions} />
          <SelectField name="batchId" label="Batch" required placeholder="Select a batch" options={batchOptions} />
          <CheckboxField
            name="grantAccess"
            label="Grant access now"
            hint="Leave unticked to create it as Pending, awaiting access."
            defaultChecked
          />
        </ModalForm>
      </PageHeader>

      <div className="grid grid-cols-2 gap-lg lg:grid-cols-5">
        <StatCard label="Total" value={counts.total} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Active" value={counts.active} icon={<UserCheck className="h-4 w-4 text-primary" />} href={href({ status: "ACTIVE", accessState: "all" })} />
        <StatCard
          label="Pending"
          value={counts.pending}
          icon={<Users className="h-4 w-4 text-secondary" />}
          hint={counts.awaitingAccess > 0 ? `${counts.awaitingAccess} awaiting access` : undefined}
          href={href({ status: "PENDING", accessState: "all" })}
        />
        <StatCard label="Completed" value={counts.completed} icon={<CircleCheck className="h-4 w-4 text-primary" />} href={href({ status: "COMPLETED", accessState: "all" })} />
        <StatCard label="Cancelled" value={counts.cancelled} icon={<CircleX className="h-4 w-4 text-error" />} href={href({ status: "CANCELLED", accessState: "all" })} />
      </div>

      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <SearchForm
            action="/admin/enrollments"
            placeholder="Search learner, program, or batch..."
            defaultValue={search}
            hidden={{
              accessState: accessState === "all" ? undefined : accessState,
              status: status === "all" ? undefined : status,
            }}
          />
          <FilterTabs
            label="Enrollment status"
            tabs={STATUS_TABS.map((tab) => ({ label: tab.label, href: href({ status: tab.value }), active: status === tab.value }))}
          />
        </div>
        <FilterTabs
          label="Access state"
          variant="segment"
          tabs={ACCESS_TABS.map((tab) => ({
            label: tab.value === "AWAITING" && counts.awaitingAccess > 0 ? `${tab.label} (${counts.awaitingAccess})` : tab.label,
            href: href({ accessState: tab.value }),
            active: accessState === tab.value,
          }))}
        />

        {page.total === 0 ? (
          <EmptyState>{search ? `No enrollments match "${search}".` : "No enrollments match this filter."}</EmptyState>
        ) : (
          <Panel className="overflow-hidden">
            <EnrollmentTable rows={page.rows} />
            <Pagination {...page} noun="enrollments" hrefFor={(next) => href({ page: next })} />
          </Panel>
        )}
      </section>
    </div>
  );
}
