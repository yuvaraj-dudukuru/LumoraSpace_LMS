import Link from "next/link";
import { Flame, History, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getDashboardData, type ActivityItem } from "@/lib/queries/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { LearnerStatusPill } from "@/components/learner-status-pill";
import { PendingWorkList } from "@/components/pending-work-list";
import { sortPendingWork } from "@/lib/queries/pending-work";
import { formatRelativeTime, formatDate } from "@/lib/format";
import type { NextStepReason } from "@/lib/next-step";

const NEXT_STEP_REASON_LABEL: Record<NextStepReason, string> = {
  revision_requested: "Revision requested",
  overdue: "Overdue",
  due_soon: "Due soon",
  next_lesson: "Up next",
};

/** One verb line per activity kind — every value here is on the item. */
function activityVerb(item: ActivityItem): string {
  switch (item.kind) {
    case "lesson_completed":
      return "Completed";
    case "assignment_submitted":
      return "Submitted";
    case "assessment_submitted": {
      const score = item.scorePercent !== null ? ` • ${item.scorePercent}%` : "";
      const result = item.passed === null ? "" : item.passed ? " • Passed" : " • Not passed";
      return `Assessment submitted${score}${result}`;
    }
    case "submission_reviewed":
      return item.outcome === "APPROVED" ? "Reviewed • Approved" : "Reviewed • Revision requested";
    case "module_completed":
      return "Module completed";
    case "certificate_issued":
      return `Certificate issued • ${item.certificateNumber}`;
  }
}

export default async function LearnHomePage() {
  const user = await requireUser();
  const data = await getDashboardData(user);

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Welcome, {user.name.split(" ")[0]}</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          You&apos;re not enrolled in a program yet. Browse our catalog to find your next cohort.
        </p>
        <Link href="/programs" className={buttonVariants({ variant: "default" })}>
          Browse Programs
        </Link>
      </div>
    );
  }

  const { progress, learnerStatus, pendingWork, nextLesson, nextStep, recentActivity, streakDays } = data;
  const nextStepModuleTitle =
    nextStep?.kind === "lesson" ? (progress.modules.find((m) => m.moduleId === nextStep.moduleId)?.title ?? null) : null;
  // Top 3 open items; completed work belongs on /learn/progress, not here.
  const topPendingWork = sortPendingWork(pendingWork)
    .filter((item) => item.state !== "completed")
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-3xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Good to see you, {data.learnerName.split(" ")[0]}.
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          {nextLesson
            ? `Ready to continue with ${nextLesson.lessonTitle}?`
            : "You've completed every lesson in this program — nice work."}
        </p>
      </header>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 flex flex-col gap-gutter lg:col-span-8">
          <section className="flex flex-col gap-lg rounded-2xl bg-surface-container-low p-xl shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                  {data.enrollment.programName}
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {nextLesson ? nextLesson.lessonTitle : "Program complete"}
                </h2>
              </div>
              {learnerStatus ? <LearnerStatusPill status={learnerStatus} /> : null}
            </div>
            <div className="flex flex-col gap-sm">
              <div className="flex items-end justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant">Progress</span>
                <span className="font-title-lg text-title-lg font-semibold text-on-surface">
                  {progress.overallPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.overallPercent}%` }}
                />
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {progress.completedLessons} of {progress.totalLessons} lessons
              </span>
            </div>
            {nextLesson ? (
              <Link
                href={`/learn/lessons/${nextLesson.lessonId}`}
                className={buttonVariants({ variant: "default", className: "w-fit" })}
              >
                Continue Learning
              </Link>
            ) : (
              <Link
                href={`/learn/programs/${data.enrollment.programId}`}
                className={buttonVariants({ variant: "outline", className: "w-fit" })}
              >
                Review Curriculum
              </Link>
            )}
          </section>

          <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-xl shadow-sm">
            <div className="flex items-center justify-between gap-md">
              <h3 className="font-title-lg text-title-lg text-on-surface">Pending Work</h3>
              <Link href="/learn/progress" className="font-label-md text-label-md text-primary hover:underline">
                View all
              </Link>
            </div>
            <PendingWorkList
              items={topPendingWork}
              emptyMessage="Nothing pending — every assignment and graded assessment in this program is done."
            />
          </section>

          {nextStep ? (
            <section
              className={`flex flex-col gap-md rounded-2xl p-xl shadow-sm ${
                nextStep.kind === "assignment"
                  ? "bg-error-container text-on-error-container"
                  : "bg-primary-container text-on-primary-container"
              }`}
            >
              <div className="flex items-center gap-sm">
                <CalendarClock className="h-5 w-5" />
                <h3 className="font-title-lg text-title-lg">Your Next Step</h3>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider opacity-90">
                  {NEXT_STEP_REASON_LABEL[nextStep.reason]}
                </span>
                <h4 className="font-headline-md text-headline-md">{nextStep.title}</h4>
                <p className="font-body-md text-body-md opacity-90">
                  {nextStep.kind === "assignment"
                    ? [
                        nextStep.moduleTitle,
                        nextStep.dueAt ? `Due ${formatDate(nextStep.dueAt)}` : "No due date",
                        nextStep.estimatedMins ? `Est. ${nextStep.estimatedMins} mins` : null,
                      ]
                        .filter((part): part is string => part !== null)
                        .join(" • ")
                    : [nextStepModuleTitle, nextStep.durationMins ? `${nextStep.durationMins} min lesson` : null]
                        .filter((part): part is string => part !== null)
                        .join(" • ")}
                </p>
              </div>
              <Link
                href={nextStep.href}
                className={`mt-auto flex w-fit items-center justify-center gap-sm rounded-lg px-md py-sm font-label-md text-label-md transition-colors ${
                  nextStep.kind === "assignment"
                    ? "bg-on-error-container text-error-container hover:bg-error hover:text-on-error"
                    : "bg-on-primary-container text-primary-container hover:opacity-90"
                }`}
              >
                {nextStep.action === "continue" ? "Continue" : "Start"}
              </Link>
            </section>
          ) : null}
        </div>

        <div className="col-span-12 flex flex-col gap-gutter lg:col-span-4">
          <section className="flex flex-col items-center gap-md rounded-2xl bg-surface-container p-xl text-center shadow-sm">
            <h3 className="w-full text-left font-title-lg text-title-lg text-on-surface">Program Progress</h3>
            <div className="relative mt-sm flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle className="stroke-surface-variant" cx="50" cy="50" r="45" fill="none" strokeWidth="8" />
                <circle
                  className="stroke-primary transition-all"
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress.overallPercent / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display-lg text-display-lg text-on-surface">
                  {progress.completedLessons}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  / {progress.totalLessons} Lessons
                </span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-md rounded-2xl bg-surface-container p-xl shadow-sm">
            <h3 className="flex items-center gap-sm font-title-lg text-title-lg text-on-surface">
              <Flame className="h-5 w-5 text-tertiary" />
              Achievements
            </h3>
            <div className="flex flex-wrap gap-sm">
              <div className="flex items-center gap-sm rounded-lg bg-surface px-md py-sm shadow-sm">
                <Flame className="h-4 w-4 text-tertiary" />
                <span className="font-label-md text-label-md text-on-surface">{streakDays}-Day Streak</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-md rounded-2xl bg-surface-container p-xl shadow-sm">
            <h3 className="flex items-center gap-sm font-title-lg text-title-lg text-on-surface">
              <History className="h-5 w-5 text-on-surface-variant" />
              Recent Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Complete a lesson to see your activity here.
              </p>
            ) : (
              <ul className="flex flex-col gap-md">
                {recentActivity.map((item, index) => (
                  <li key={`${item.kind}-${index}`} className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                    <span className="font-body-md text-sm text-on-surface-variant">
                      {activityVerb(item)} • {formatRelativeTime(item.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
