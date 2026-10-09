import Link from "next/link";
import { Plus, Users } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getUserCounts, getUsersForAdmin } from "@/lib/queries/admin";
import { buildHref, paginate } from "@/lib/pagination";
import { formatRelativeTime } from "@/lib/format";
import { ModalForm } from "@/components/admin/modal-form";
import { FieldRow, SelectField, TextField } from "@/components/admin/fields";
import { ROLE_LABEL, USER_STATUS } from "@/components/admin/status";
import { Avatar, EmptyState, FilterTabs, PageHeader, Pagination, Panel, SearchForm, StatCard, StatusPill, TH } from "@/components/admin/ui";
import { createUserFromForm } from "./actions";

const ROLE_TABS: { value: Role | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "LEARNER", label: "Learners" },
  { value: "MENTOR", label: "Mentors" },
  { value: "ADMIN", label: "Admins" },
];

const ROLE_TEXT: Record<Role, string> = {
  LEARNER: "text-on-surface",
  MENTOR: "text-primary",
  ADMIN: "text-secondary",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const role: Role | "all" = ROLE_TABS.some((tab) => tab.value === params.role) ? (params.role as Role | "all") : "all";
  const search = params.search?.trim() || undefined;

  const [counts, users] = await Promise.all([getUserCounts(), getUsersForAdmin({ role, search })]);
  const page = paginate(users, params.page);
  const href = (next: { role?: Role | "all"; page?: number }) =>
    buildHref("/admin/users", { role: next.role ?? role, search, page: next.page }, { role: "all", page: 1 });

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Users" description="Manage learners, mentors, and administrators across LumoraSpace.">
        <ModalForm
          trigger={
            <>
              <Plus className="h-4 w-4" /> Add User
            </>
          }
          title="Add User"
          description="Public sign-up only creates learners; mentors and admins are added here."
          submitLabel="Create Account"
          pendingLabel="Creating..."
          action={createUserFromForm}
        >
          <FieldRow>
            <TextField name="name" label="Full name" required maxLength={120} />
            <SelectField
              name="role"
              label="Role"
              required
              defaultValue="MENTOR"
              options={[
                { value: "MENTOR", label: "Mentor" },
                { value: "ADMIN", label: "Admin" },
                { value: "LEARNER", label: "Learner" },
              ]}
            />
          </FieldRow>
          <TextField name="email" label="Email" type="email" required />
          <TextField name="password" label="Temporary password" type="password" required minLength={8} hint="At least 8 characters." />
        </ModalForm>
      </PageHeader>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={counts.total} />
        <StatCard label="Learners" value={counts.learners} href={href({ role: "LEARNER" })} />
        <StatCard label="Mentors" value={counts.mentors} href={href({ role: "MENTOR" })} />
        <StatCard label="Admins" value={counts.admins} href={href({ role: "ADMIN" })} />
      </div>

      <Panel className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-md p-lg">
          <SearchForm
            action="/admin/users"
            placeholder="Search by name or email..."
            defaultValue={search}
            hidden={{ role: role === "all" ? undefined : role }}
          />
          <FilterTabs
            label="Role"
            tabs={ROLE_TABS.map((tab) => ({ label: tab.label, href: href({ role: tab.value }), active: role === tab.value }))}
          />
        </div>

        {page.total === 0 ? (
          <div className="p-lg pt-0">
            <EmptyState icon={<Users className="h-10 w-10 text-on-surface-variant" />}>
              {search ? `No users match "${search}".` : "No users in this filter."}
            </EmptyState>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-y border-outline-variant/40">
                    <th className={TH}>User</th>
                    <th className={TH}>Role</th>
                    <th className={TH}>Program / Batch</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Last Active</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((user) => (
                    <tr key={user.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low">
                      <td className="p-md">
                        <div className="flex items-center gap-md">
                          <Avatar name={user.name} size="lg" />
                          <div className="flex min-w-0 flex-col">
                            <Link href={`/admin/users/${user.id}`} className="truncate font-body-md text-body-md text-on-surface hover:text-primary">
                              {user.name}
                            </Link>
                            <span className="truncate font-label-md text-label-md text-on-surface-variant">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`p-md font-body-md text-body-md ${ROLE_TEXT[user.role]}`}>{ROLE_LABEL[user.role]}</td>
                      <td className="p-md font-body-md text-body-md text-on-surface-variant">
                        {user.placement ? (
                          <>
                            {user.placement.programName}
                            {user.placement.batchName ? (
                              <>
                                <span className="px-sm text-secondary" aria-hidden="true">
                                  •
                                </span>
                                {user.placement.batchName}
                              </>
                            ) : null}
                            {user.placement.more > 0 ? (
                              <span className="pl-sm font-label-sm text-label-sm">+{user.placement.more} more</span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-md">
                        <StatusPill tone={USER_STATUS[user.status].tone}>{USER_STATUS[user.status].label}</StatusPill>
                      </td>
                      <td className="whitespace-nowrap p-md font-body-md text-body-md text-on-surface-variant">
                        {user.lastActiveAt ? formatRelativeTime(user.lastActiveAt) : "—"}
                      </td>
                      <td className="p-md text-right">
                        <Link
                          href={`/admin/users/${user.id}`}
                          aria-label={`Manage ${user.name}`}
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

            {/* Mobile cards (users_mobile) */}
            <ul className="flex flex-col md:hidden">
              {page.rows.map((user) => (
                <li key={user.id} className="border-t border-outline-variant/30">
                  <Link href={`/admin/users/${user.id}`} className="flex items-center gap-md p-md">
                    <Avatar name={user.name} size="lg" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-body-md text-body-md text-on-surface">{user.name}</span>
                      <span className="truncate font-label-md text-label-md text-on-surface-variant">{user.email}</span>
                      <span className="truncate font-label-sm text-label-sm text-on-surface-variant">
                        {ROLE_LABEL[user.role]}
                        {user.placement ? ` · ${user.placement.programName}` : ""}
                      </span>
                    </span>
                    <StatusPill tone={USER_STATUS[user.status].tone}>{USER_STATUS[user.status].label}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination {...page} noun="users" hrefFor={(next) => href({ page: next })} />
          </>
        )}
      </Panel>
    </div>
  );
}
