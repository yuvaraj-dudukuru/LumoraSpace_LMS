import Link from "next/link";
import { ArrowDown, ArrowUp, Award, CircleAlert, CircleCheck, Download, UserPlus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import {
  ANALYTICS_RANGE_DAYS,
  DEFAULT_ANALYTICS_RANGE,
  getAdminAnalytics,
  parseAnalyticsRange,
  type Trend,
} from "@/lib/queries/admin-analytics";
import { LineChart } from "@/components/admin/line-chart";
import { CONTENT_STATUS } from "@/components/admin/status";
import { FilterTabs, OUTLINE_BUTTON, PageHeader, Panel, ProgressBar, StatusPill, TH } from "@/components/admin/ui";

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireRole("ADMIN");
  const range = parseAnalyticsRange((await searchParams).range);
  const data = await getAdminAnalytics(range, new Date());

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Analytics" description="Understand learner progress, program performance, and platform activity.">
        <FilterTabs
          label="Date range"
          variant="segment"
          tabs={ANALYTICS_RANGE_DAYS.map((days) => ({
            label: `Last ${days} Days`,
            href: days === DEFAULT_ANALYTICS_RANGE ? "/admin/analytics" : `/admin/analytics?range=${days}`,
            active: range === days,
          }))}
        />
        <a href="/admin/analytics/export" className={OUTLINE_BUTTON}>
          <Download className="h-4 w-4" /> Export Report
        </a>
      </PageHeader>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <TrendCard label="Active Learners" icon={<Users className="h-5 w-5" />} trend={data.activeLearners} />
        <TrendCard label="New Enrollments" icon={<UserPlus className="h-5 w-5" />} trend={data.newEnrollments} />
        <div className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
          <span className="flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
            Completion Rate <CircleCheck className="h-5 w-5" />
          </span>
          <span className="font-display-lg-mobile text-display-lg-mobile text-on-surface">{data.completionRatePercent}%</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Of all enrollments, to date</span>
        </div>
        <TrendCard label="Certificates Issued" icon={<Award className="h-5 w-5" />} trend={data.certificatesIssued} />
      </div>

      <div className="grid grid-cols-1 gap-xl xl:grid-cols-3">
        <Panel className="flex flex-col gap-lg p-lg xl:col-span-2">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Learner Activity</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">
              Learners who completed a lesson, submitted work or started an assessment, per period.
            </p>
          </div>
          <LineChart
            title={`Learner activity over the last ${range} days`}
            labels={data.chart.labels}
            series={[
              { label: "Active Learners", values: data.chart.activeLearners },
              { label: "Completed Learners", values: data.chart.completions },
            ]}
          />
        </Panel>

        <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-lg">
          <h2 className="flex items-center gap-sm font-headline-md text-headline-md text-on-surface">
            <CircleAlert className="h-6 w-6 text-error" /> Needs Attention
          </h2>
          {data.alerts.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">No issues found in the current data.</p>
          ) : (
            data.alerts.map((alert) => (
              <div key={alert.id} className="flex flex-col gap-sm rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-md">
                <p className="flex items-start gap-sm font-body-md text-body-md text-on-surface">
                  <span
                    className={`mt-sm h-2 w-2 shrink-0 rounded-full ${alert.tone === "error" ? "bg-error" : "bg-warning"}`}
                    aria-hidden="true"
                  />
                  {alert.message}
                </p>
                <Link href={alert.href} className="pl-md font-label-md text-label-md text-primary hover:underline">
                  {alert.linkLabel}
                </Link>
              </div>
            ))
          )}
        </section>
      </div>

      <Panel className="overflow-hidden">
        <h2 className="p-lg font-headline-md text-headline-md text-on-surface">Program Performance</h2>
        {data.programs.length === 0 ? (
          <p className="p-lg pt-0 font-body-md text-body-md text-on-surface-variant">No programs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-y border-outline-variant/40 bg-surface-container-low">
                  <th className={TH}>Program</th>
                  <th className={`${TH} text-right`}>Enrollments</th>
                  <th className={`${TH} text-right`}>Active</th>
                  <th className={TH}>Completion</th>
                  <th className={TH}>Avg Progress</th>
                  <th className={`${TH} text-right`}>Certificates</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.programs.map((program) => (
                  <tr key={program.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="p-md font-body-md text-body-md text-on-surface">{program.name}</td>
                    <td className="p-md text-right font-body-md text-body-md text-on-surface">{program.enrollments}</td>
                    <td className="p-md text-right font-body-md text-body-md text-on-surface">{program.active}</td>
                    <td className="p-md">
                      <Meter percent={program.completionPercent} label={`${program.name} completion`} />
                    </td>
                    <td className="p-md">
                      <Meter percent={program.averageProgressPercent} label={`${program.name} average progress`} />
                    </td>
                    <td className="p-md text-right font-body-md text-body-md text-on-surface">{program.certificates}</td>
                    <td className="p-md">
                      <StatusPill tone={CONTENT_STATUS[program.status].tone} dot={false}>
                        {CONTENT_STATUS[program.status].label}
                      </StatusPill>
                    </td>
                    <td className="p-md text-right">
                      <Link
                        href={`/admin/programs/${program.id}`}
                        aria-label={`View ${program.name}`}
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
        )}
      </Panel>
    </div>
  );
}

function TrendCard({ label, icon, trend }: { label: string; icon: React.ReactNode; trend: Trend }) {
  const change = trend.changePercent;
  return (
    <div className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
      <span className="flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
        {label} {icon}
      </span>
      <span className="font-display-lg-mobile text-display-lg-mobile text-on-surface">{trend.value.toLocaleString("en-US")}</span>
      {change === null ? (
        <span className="font-label-sm text-label-sm text-on-surface-variant">No earlier period to compare</span>
      ) : (
        <span className="flex items-center gap-sm font-label-sm text-label-sm text-on-surface-variant">
          <span
            className={`inline-flex items-center gap-xs rounded-full px-sm py-xs ${change >= 0 ? "bg-success-container text-success" : "bg-error-container text-on-error-container"}`}
          >
            {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            <span className="sr-only">{change >= 0 ? "Up" : "Down"}</span>
            {Math.abs(change)}%
          </span>
          vs prev period
        </span>
      )}
    </div>
  );
}

function Meter({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="flex w-32 items-center gap-sm">
      <span className="w-10 shrink-0 font-label-md text-label-md text-on-surface">{percent}%</span>
      <ProgressBar percent={percent} label={label} />
    </div>
  );
}
