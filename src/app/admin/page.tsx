import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  ClipboardCheck,
  Contact,
  Flame,
  GraduationCap,
  Layers,
  TriangleAlert,
  UserPlus,
  UserRoundX,
  Users,
  Zap,
} from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { ANALYTICS_RANGE_DAYS, getAdminDashboard, parseAnalyticsRange } from "@/lib/queries/admin-analytics";
import { formatRelativeTime } from "@/lib/format";
import { LineChart } from "@/components/admin/line-chart";
import { CONTENT_STATUS } from "@/components/admin/status";
import { FilterTabs, PageHeader, Panel, ProgressBar, StatusPill, TH } from "@/components/admin/ui";

const QUICK_ACTIONS = [
  { href: "/admin/users", icon: UserPlus, title: "Add User", detail: "Invite new learners or staff" },
  { href: "/admin/programs", icon: GraduationCap, title: "Create Program", detail: "Draft a new learning path" },
  { href: "/admin/batches", icon: Layers, title: "Create Batch", detail: "Schedule a new cohort" },
  { href: "/admin/mentors", icon: Contact, title: "Assign Mentor", detail: "Link learners to guides" },
] as const;

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireRole("ADMIN");
  const range = parseAnalyticsRange((await searchParams).range);
  const data = await getAdminDashboard(range, new Date());

  const attention = [
    {
      count: data.attention.pendingReviews,
      label: "Assignments waiting for review",
      link: "View Reviews",
      href: "/mentor/submissions?filter=pending",
      icon: ClipboardCheck,
    },
    {
      count: data.attention.learnersWithoutMentor,
      label: "Active learners in a batch with no mentor",
      link: "Assign Mentors",
      href: "/admin/batches?status=ACTIVE",
      icon: UserRoundX,
    },
    {
      count: data.attention.awaitingAccess,
      label: "Enrollments awaiting access",
      link: "Grant Access",
      href: "/admin/enrollments?accessState=AWAITING",
      icon: Users,
    },
  ];
  const nothingNeedsAttention = attention.every((item) => item.count === 0);

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Dashboard" description="Overview of your LumoraSpace platform.">
        <FilterTabs
          label="Activity range"
          variant="segment"
          tabs={ANALYTICS_RANGE_DAYS.map((days) => ({
            label: `${days}d`,
            href: days === 30 ? "/admin" : `/admin?range=${days}`,
            active: range === days,
          }))}
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-xl xl:grid-cols-3">
        <div className="flex flex-col gap-xl xl:col-span-2">
          <section
            className={`flex flex-col gap-lg rounded-2xl p-lg ${nothingNeedsAttention ? "bg-surface-container-low" : "bg-error-container/50"}`}
          >
            <h2 className={`flex items-center gap-sm font-title-lg text-title-lg ${nothingNeedsAttention ? "text-on-surface" : "text-on-error-container"}`}>
              <TriangleAlert className="h-5 w-5" /> Needs Attention
            </h2>
            {nothingNeedsAttention ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Nothing is waiting on an admin right now.</p>
            ) : null}
            <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
              {attention.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex flex-col gap-sm rounded-xl bg-surface-container-lowest/70 p-md">
                    <div className="flex items-start justify-between">
                      <span className={`font-headline-lg text-headline-lg ${item.count > 0 ? "text-error" : "text-on-surface-variant"}`}>
                        {item.count}
                      </span>
                      <Icon className={`h-5 w-5 ${item.count > 0 ? "text-error" : "text-on-surface-variant"}`} aria-hidden="true" />
                    </div>
                    <p className="flex-1 font-label-md text-label-md text-on-surface">{item.label}</p>
                    <Link href={item.href} className="flex items-center gap-xs font-label-md text-label-md text-primary hover:underline">
                      {item.link} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-lg lg:grid-cols-4">
            <Tile icon={<Users className="h-5 w-5" />} label="Total Learners" value={data.totalLearners} />
            <Tile icon={<Flame className="h-5 w-5" />} label="Active Learners" value={data.activeLearners} />
            <Tile icon={<GraduationCap className="h-5 w-5" />} label="Published Programs" value={data.publishedPrograms} />
            <Tile icon={<Contact className="h-5 w-5" />} label="Active Mentors" value={data.activeMentors} />
          </div>
        </div>

        <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-lg">
          <h2 className="flex items-center gap-sm font-title-lg text-title-lg text-on-surface">
            <Zap className="h-5 w-5 text-primary" /> Quick Actions
          </h2>
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-md rounded-xl bg-surface-container-lowest p-md transition-colors hover:bg-surface-container"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">{action.title}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{action.detail}</span>
                </span>
              </Link>
            );
          })}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-2">
        <Panel className="flex flex-col gap-lg p-lg">
          <div>
            <h2 className="font-title-lg text-title-lg text-on-surface">Enrollment Activity</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">Last {range} days</p>
          </div>
          <LineChart
            title={`Enrollment activity over the last ${range} days`}
            labels={data.chart.labels}
            series={[
              { label: "New", values: data.chart.newEnrollments },
              { label: "Active", values: data.chart.activeLearners },
              { label: "Completed", values: data.chart.completions },
            ]}
          />
        </Panel>

        <Panel className="flex flex-col gap-lg p-lg">
          <div>
            <h2 className="font-title-lg text-title-lg text-on-surface">Learning Activity</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">Last {range} days</p>
          </div>
          <div className="flex flex-1 flex-col justify-center divide-y divide-outline-variant/40">
            <ActivityStat icon={<BookOpenCheck className="h-6 w-6" />} value={data.lessonsCompleted} label="Lessons Completed" />
            <ActivityStat icon={<ClipboardCheck className="h-6 w-6" />} value={data.assignmentsSubmitted} label="Assignments Submitted" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-xl xl:grid-cols-3">
        <Panel className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between gap-md p-lg">
            <h2 className="font-title-lg text-title-lg text-on-surface">Program Performance</h2>
            <Link href="/admin/analytics" className="flex items-center gap-xs font-label-md text-label-md text-primary hover:underline">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {data.programs.length === 0 ? (
            <p className="p-lg pt-0 font-body-md text-body-md text-on-surface-variant">No programs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-y border-outline-variant/40">
                    <th className={TH}>Program</th>
                    <th className={`${TH} text-right`}>Enrolled</th>
                    <th className={TH}>Completion Rate</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.programs.map((program) => (
                    <tr key={program.id} className="border-b border-outline-variant/20 last:border-0">
                      <td className="p-md">
                        <Link href={`/admin/programs/${program.id}`} className="font-body-md text-body-md text-on-surface hover:text-primary">
                          {program.name}
                        </Link>
                      </td>
                      <td className="p-md text-right font-body-md text-body-md text-on-surface">{program.enrollments}</td>
                      <td className="p-md">
                        <div className="flex w-40 items-center gap-sm">
                          <span className="w-10 shrink-0 font-label-md text-label-md text-on-surface">{program.completionPercent}%</span>
                          <ProgressBar percent={program.completionPercent} label={`${program.name} completion rate`} />
                        </div>
                      </td>
                      <td className="p-md">
                        <StatusPill tone={CONTENT_STATUS[program.status].tone} dot={false}>
                          {CONTENT_STATUS[program.status].label}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-lg">
          <h2 className="font-title-lg text-title-lg text-on-surface">Recent Activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Nothing has happened yet.</p>
          ) : (
            <ol className="flex flex-col">
              {data.recentActivity.map((item, index) => (
                <li key={item.id} className="flex gap-md">
                  <div className="flex flex-col items-center">
                    <span className="mt-sm h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    {index < data.recentActivity.length - 1 ? <span className="w-px flex-1 bg-outline-variant/60" aria-hidden="true" /> : null}
                  </div>
                  <Link href={item.href} className="group flex min-w-0 flex-col pb-md">
                    <span className="font-label-md text-label-md text-on-surface group-hover:text-primary">{item.title}</span>
                    <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{item.detail}</span>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">{formatRelativeTime(item.at)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <Link
            href="/admin/analytics"
            className="mt-auto flex items-center justify-center gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <Award className="h-4 w-4" /> Open Analytics
          </Link>
        </section>
      </div>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-sm rounded-2xl bg-surface-container-lowest p-lg">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">{icon}</span>
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <span className="font-headline-lg text-headline-lg text-on-surface">{value.toLocaleString("en-US")}</span>
    </div>
  );
}

function ActivityStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-md py-lg">
      <div className="flex flex-col">
        <span className="font-headline-lg text-headline-lg text-on-surface">{value.toLocaleString("en-US")}</span>
        <span className="font-body-md text-body-md text-on-surface-variant">{label}</span>
      </div>
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary-fixed text-primary">{icon}</span>
    </div>
  );
}
