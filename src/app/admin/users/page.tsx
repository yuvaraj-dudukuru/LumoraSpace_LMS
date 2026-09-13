import Link from "next/link";
import { Search } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getUsersForAdmin } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { CreateUserForm } from "./create-user-form";

const ROLE_TABS: { value: Role | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "LEARNER", label: "Learners" },
  { value: "MENTOR", label: "Mentors" },
  { value: "ADMIN", label: "Admins" },
];

const ROLE_STYLES: Record<string, string> = {
  LEARNER: "bg-surface-container-high text-on-surface-variant",
  MENTOR: "bg-secondary-container text-on-secondary-container",
  ADMIN: "bg-primary-container text-on-primary-container",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-success-container text-success",
  INACTIVE: "bg-error-container text-on-error-container",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const role: Role | "all" = ROLE_TABS.some((tab) => tab.value === params.role) ? (params.role as Role | "all") : "all";
  const search = params.search?.trim() || undefined;

  const users = await getUsersForAdmin({ role, search });

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex flex-col gap-sm">
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
            Users
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            Manage learners, mentors, and administrators.
          </p>
        </div>
        <CreateUserForm />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex flex-wrap gap-sm">
          {ROLE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/admin/users" : `/admin/users?role=${tab.value}`}
              className={`rounded-full px-lg py-sm font-label-md text-label-md transition-colors ${
                role === tab.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form method="GET" action="/admin/users" className="flex items-center gap-sm">
          {role !== "all" ? <input type="hidden" name="role" value={role} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search name or email..."
              className="w-full rounded-lg border border-outline-variant bg-surface py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-72"
            />
          </div>
        </form>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {search ? `No users match "${search}".` : "No users in this filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">User</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Role</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Status</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="p-md align-top">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-label-md text-label-md text-on-surface hover:underline"
                    >
                      {user.name}
                    </Link>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{user.email}</p>
                  </td>
                  <td className="p-md align-top">
                    <span className={`rounded-full px-md py-xs font-label-sm text-label-sm ${ROLE_STYLES[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-md align-top">
                    <span
                      className={`rounded-full px-md py-xs font-label-sm text-label-sm ${STATUS_STYLES[user.status]}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="p-md align-top font-label-sm text-label-sm text-on-surface-variant">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
