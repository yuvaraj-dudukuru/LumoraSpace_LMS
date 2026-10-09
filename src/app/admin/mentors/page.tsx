import Link from "next/link";
import { CalendarCheck, CircleCheck, Contact, IdCard, Plus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import {
  getMentorsForAdmin,
  MENTOR_FULL_LOAD_LEARNERS,
  type MentorFilter,
  type WorkloadLevel,
} from "@/lib/queries/admin-mentors";
import { buildHref, paginate } from "@/lib/pagination";
import { addMentor } from "@/app/admin/users/actions";
import { ModalForm } from "@/components/admin/modal-form";
import { FieldRow, TextField } from "@/components/admin/fields";
import { USER_STATUS } from "@/components/admin/status";
import { Avatar, EmptyState, FilterTabs, Pagination, Panel, ProgressBar, SearchForm, StatCard, StatusPill, TH } from "@/components/admin/ui";

const TABS: { value: MentorFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
];

const WORKLOAD_STYLE: Record<WorkloadLevel, { text: string; bar: string }> = {
  High: { text: "text-error", bar: "bg-error" },
  Moderate: { text: "text-primary", bar: "bg-primary" },
  Low: { text: "text-on-surface-variant", bar: "bg-outline" },
};

export default async function AdminMentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; search?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const view: MentorFilter = TABS.find((tab) => tab.value === params.view)?.value ?? "all";
  const search = params.search?.trim() || undefined;

  const { counts, rows } = await getMentorsForAdmin({ view, search });
  const page = paginate(rows, params.page);
  const href = (next: { view?: MentorFilter; page?: number }) =>
    buildHref("/admin/mentors", { view: next.view ?? view, search, page: next.page }, { view: "all", page: 1 });

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-wrap items-center justify-between gap-lg rounded-2xl bg-surface-container-low p-xl">
        <div className="flex flex-col gap-sm">
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
            Mentors
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            Manage mentor assignments and support coverage across LumoraSpace programs.
          </p>
        </div>
        <ModalForm
          trigger={
            <>
              <Plus className="h-4 w-4" /> Add Mentor
            </>
          }
          title="Add Mentor"
          description="Creates a mentor account. You'll assign batches on the next screen."
          submitLabel="Add Mentor"
          pendingLabel="Adding..."
          action={addMentor}
        >
          <FieldRow>
            <TextField name="name" label="Full name" required maxLength={120} />
            <TextField name="title" label="Title" maxLength={80} placeholder="Senior Mentor" />
          </FieldRow>
          <TextField name="email" label="Email" type="email" required />
          <TextField
            name="password"
            label="Temporary password"
            type="password"
            required
            minLength={8}
            hint="At least 8 characters. Share it with the mentor; they can change it in Settings."
          />
        </ModalForm>
      </header>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Mentors" value={counts.total} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active" value={counts.active} icon={<CircleCheck className="h-4 w-4 text-primary" />} href={href({ view: "active" })} />
        <StatCard
          label="Available"
          value={counts.available}
          icon={<CalendarCheck className="h-4 w-4 text-primary" />}
          hint="No upcoming or active batch"
          href={href({ view: "available" })}
        />
        <StatCard label="Assigned" value={counts.assigned} icon={<IdCard className="h-4 w-4 text-primary" />} href={href({ view: "assigned" })} />
      </div>

      <Panel className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-md p-lg">
          <SearchForm
            action="/admin/mentors"
            placeholder="Search mentors..."
            defaultValue={search}
            hidden={{ view: view === "all" ? undefined : view }}
          />
          <FilterTabs
            label="Mentor filter"
            variant="segment"
            tabs={TABS.map((tab) => ({ label: tab.label, href: href({ view: tab.value }), active: view === tab.value }))}
          />
        </div>

        {page.total === 0 ? (
          <div className="p-lg pt-0">
            <EmptyState icon={<Contact className="h-10 w-10 text-on-surface-variant" />}>
              {search ? `No mentors match "${search}".` : "No mentors match this filter."}
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-y border-outline-variant/40">
                    <th className={TH}>Mentor</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Programs</th>
                    <th className={`${TH} text-right`}>Batches</th>
                    <th className={`${TH} text-right`}>Learners</th>
                    <th className={TH}>Workload</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((mentor) => (
                    <tr key={mentor.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low">
                      <td className="p-md">
                        <div className="flex items-center gap-md">
                          <Avatar name={mentor.name} size="lg" />
                          <div className="flex min-w-0 flex-col">
                            <Link href={`/admin/users/${mentor.id}`} className="truncate font-title-lg text-title-lg text-on-surface hover:text-primary">
                              {mentor.name}
                            </Link>
                            <span className="truncate font-body-md text-body-md text-on-surface-variant">
                              {mentor.title ? `${mentor.title} · ` : ""}
                              {mentor.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-md">
                        <StatusPill tone={USER_STATUS[mentor.status].tone}>{USER_STATUS[mentor.status].label}</StatusPill>
                      </td>
                      <td className="p-md text-right font-body-md text-body-md text-on-surface">{mentor.programCount}</td>
                      <td className="p-md text-right font-body-md text-body-md text-on-surface">{mentor.batchCount}</td>
                      <td className="p-md text-right font-body-md text-body-md text-on-surface">{mentor.learnerCount}</td>
                      <td className="p-md">
                        <div className="flex w-32 flex-col gap-xs">
                          <div className="flex items-center justify-between font-label-md text-label-md">
                            <span className={WORKLOAD_STYLE[mentor.workloadLevel].text}>{mentor.workloadLevel}</span>
                            <span className="text-on-surface">{mentor.workloadPercent}%</span>
                          </div>
                          <ProgressBar
                            percent={mentor.workloadPercent}
                            label={`${mentor.name} workload`}
                            tone={WORKLOAD_STYLE[mentor.workloadLevel].bar}
                          />
                        </div>
                      </td>
                      <td className="p-md text-right">
                        <Link
                          href={`/admin/users/${mentor.id}`}
                          aria-label={`Manage ${mentor.name}`}
                          className="font-label-md text-label-md text-primary hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...page} noun="mentors" hrefFor={(next) => href({ page: next })} />
          </>
        )}
      </Panel>

      <p className="font-label-sm text-label-sm text-on-surface-variant">
        Workload compares a mentor&apos;s current learners with a full load of {MENTOR_FULL_LOAD_LEARNERS}. Only upcoming and
        active batches count.
      </p>
    </div>
  );
}
