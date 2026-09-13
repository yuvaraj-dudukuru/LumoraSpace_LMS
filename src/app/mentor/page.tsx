import Link from "next/link";
import { ClipboardCheck, AlertTriangle, History, CalendarClock, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getMentorBatchIds, getMentorDashboard, getReviewQueue, NEEDS_ATTENTION_STALE_DAYS } from "@/lib/queries/mentor";
import { formatDate, formatRelativeTime } from "@/lib/format";

export default async function MentorDashboardPage() {
  const user = await requireRole("MENTOR", "ADMIN");
  const batchIds = await getMentorBatchIds(user);

  if (batchIds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <ClipboardCheck className="h-12 w-12 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">No Batches Assigned Yet</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          You&apos;re not assigned to any batch right now. Once an admin assigns you to one, your
          dashboard, learners, and review queue will show up here.
        </p>
      </div>
    );
  }

  const [dashboard, queue] = await Promise.all([
    getMentorDashboard(batchIds),
    getReviewQueue(batchIds, "all"),
  ]);
  const pendingPreview = queue
    .filter((item) => item.status === "SUBMITTED" || item.status === "UNDER_REVIEW")
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-2xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Good to see you, {user.name.split(" ")[0]}.
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Here&apos;s what needs your attention today.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Link
          href="/mentor/submissions?filter=pending"
          className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm transition-colors hover:bg-surface-container"
        >
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Pending Reviews
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">
              {dashboard.pendingReviewCount}
            </p>
          </div>
          <ClipboardCheck className="h-8 w-8 text-primary" />
        </Link>
        <Link
          href="/mentor/learners?status=needs_attention"
          className="flex items-center justify-between rounded-2xl bg-surface-container-low p-xl shadow-sm transition-colors hover:bg-surface-container"
        >
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              At Risk
            </p>
            <p className="mt-xs font-display-lg text-display-lg text-on-surface">
              {dashboard.atRiskLearners.length}
            </p>
          </div>
          <AlertTriangle className="h-8 w-8 text-error" />
        </Link>
      </div>

      <section className="flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">Needs Your Attention</h2>
        {dashboard.atRiskLearners.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low p-lg font-body-md text-body-md text-on-surface-variant">
            No learners need attention right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-md md:grid-cols-3">
            {dashboard.atRiskLearners.slice(0, 3).map((learner) => (
              <Link
                key={learner.userId}
                href={`/mentor/learners/${learner.userId}`}
                className="flex flex-col gap-sm rounded-xl border border-error/20 bg-error-container/30 p-lg transition-colors hover:bg-error-container/50"
              >
                <span className="font-title-lg text-title-lg text-on-surface">{learner.userName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{learner.programName}</span>
                <span className="font-label-md text-label-md text-error">
                  {learner.daysSinceActive === null
                    ? "No activity yet"
                    : `Last active ${learner.daysSinceActive}d ago`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <section className="flex flex-col gap-md lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">Pending Reviews</h2>
            <Link href="/mentor/submissions" className="font-label-md text-label-md text-primary hover:underline">
              View All
            </Link>
          </div>
          {pendingPreview.length === 0 ? (
            <p className="rounded-xl bg-surface-container-low p-lg font-body-md text-body-md text-on-surface-variant">
              Nothing to review right now.
            </p>
          ) : (
            <ul className="flex flex-col gap-sm">
              {pendingPreview.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/mentor/submissions/${item.id}`}
                    className="flex items-center justify-between gap-md rounded-xl bg-surface-container-low p-md transition-colors hover:bg-surface-container"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-label-md text-label-md text-on-surface">
                        {item.assignmentTitle}
                      </p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        {item.learnerName} · {item.programName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-md">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {item.submittedAt ? formatRelativeTime(item.submittedAt) : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-xl">
          <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-lg">
            <h2 className="flex items-center gap-sm font-title-lg text-title-lg text-on-surface">
              <CalendarClock className="h-5 w-5 text-on-surface-variant" /> Upcoming Due Dates
            </h2>
            {dashboard.upcomingDueDates.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No upcoming due dates.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {dashboard.upcomingDueDates.map((assignment) => (
                  <li key={assignment.assignmentId} className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">{assignment.title}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {assignment.programName} · Due {formatDate(assignment.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-lg">
            <h2 className="flex items-center gap-sm font-title-lg text-title-lg text-on-surface">
              <History className="h-5 w-5 text-on-surface-variant" /> Recent Activity
            </h2>
            {dashboard.recentActivity.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No recent submissions.</p>
            ) : (
              <ul className="flex flex-col gap-md">
                {dashboard.recentActivity.map((item) => (
                  <li key={item.submissionId} className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">
                      {item.learnerName} submitted {item.assignmentTitle}
                    </span>
                    <span className="font-body-md text-sm text-on-surface-variant">
                      {formatRelativeTime(item.submittedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="font-label-sm text-label-sm text-on-surface-variant">
        &ldquo;At Risk&rdquo; means no activity in {NEEDS_ATTENTION_STALE_DAYS}+ days, a failed assessment
        attempt, or an outstanding revision request.
      </p>
    </div>
  );
}
