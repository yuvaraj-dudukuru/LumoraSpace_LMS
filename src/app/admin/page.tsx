import Link from "next/link";
import { Users, UserCheck, Clock, ClipboardCheck, Award } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getAdminDashboardStats } from "@/lib/queries/admin";

export default async function AdminDashboardPage() {
  const user = await requireRole("ADMIN");
  const stats = await getAdminDashboardStats();

  return (
    <div className="flex flex-col gap-2xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Overview
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Welcome back, {user.name.split(" ")[0]}. Here&apos;s the state of the platform.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Total Learners
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">{stats.totalLearners}</p>
          </div>
          <Users className="h-8 w-8 text-primary" />
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Active Enrollments
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">{stats.activeEnrollments}</p>
          </div>
          <UserCheck className="h-8 w-8 text-primary" />
        </div>

        <Link
          href="/admin/enrollments?accessState=AWAITING"
          className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm transition-colors hover:bg-surface-container"
        >
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Awaiting Access
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">{stats.awaitingEnrollments}</p>
          </div>
          <Clock className="h-8 w-8 text-warning" />
        </Link>

        <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Pending Reviews
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">{stats.pendingReviews}</p>
          </div>
          <ClipboardCheck className="h-8 w-8 text-primary" />
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Certificates Issued
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">{stats.certificatesIssued}</p>
          </div>
          <Award className="h-8 w-8 text-primary" />
        </div>
      </div>

      <div className="flex flex-wrap gap-md">
        <Link
          href="/admin/enrollments"
          className="rounded-full bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          Manage Enrollments
        </Link>
        <Link
          href="/admin/users"
          className="rounded-full bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          Manage Users
        </Link>
        <Link
          href="/admin/certificates"
          className="rounded-full bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          View Certificates
        </Link>
      </div>
    </div>
  );
}
