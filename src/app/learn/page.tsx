import Link from "next/link";
import { Flame, History, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getDashboardData } from "@/lib/queries/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { LearnerStatusPill } from "@/components/learner-status-pill";
import { formatRelativeTime, formatDate } from "@/lib/format";

export default async function LearnHomePage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

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

  const { progress, learnerStatus, nextLesson, nextAssignment, recentActivity, streakDays } = data;

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

          {nextAssignment ? (
            <section className="flex flex-col gap-md rounded-2xl bg-error-container p-xl text-on-error-container shadow-sm">
              <div className="flex items-center gap-sm">
                <CalendarClock className="h-5 w-5" />
                <h3 className="font-title-lg text-title-lg">Your Next Step</h3>
              </div>
              <div className="flex flex-col gap-xs">
                <h4 className="font-headline-md text-headline-md">{nextAssignment.title}</h4>
                <p className="font-body-md text-body-md opacity-90">
                  Due {formatDate(nextAssignment.dueAt)}
                  {nextAssignment.estimatedMins ? ` • Est. ${nextAssignment.estimatedMins} mins` : ""}
                </p>
              </div>
              <Link
                href={`/learn/assignments/${nextAssignment.id}`}
                className="mt-auto flex w-fit items-center justify-center gap-sm rounded-lg bg-on-error-container px-md py-sm font-label-md text-label-md text-error-container transition-colors hover:bg-error hover:text-on-error"
              >
                View Assignment
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
                  <li key={index} className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                    <span className="font-body-md text-sm text-on-surface-variant">
                      {item.kind === "lesson_completed" ? "Completed" : "Submitted"} •{" "}
                      {formatRelativeTime(item.occurredAt)}
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
