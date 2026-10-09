import Link from "next/link";
import { Target, Clock, CircleHelp, ClipboardList, FileQuestion, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AccessState } from "@prisma/client";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import {
  getPracticeActivities,
  isActionablePractice,
  type PracticeActivity,
  type PracticeActivityKind,
  type PracticeActivityStatus,
} from "@/lib/queries/practice";
import { buttonVariants } from "@/components/ui/button";

type TabValue = "all" | "quizzes" | "assignments" | "assessments";

// Projects are assignments in the schema (Assignment.type), so they share the tab.
const TABS: { value: TabValue; label: string; kinds: PracticeActivityKind[] }[] = [
  { value: "all", label: "All", kinds: ["quiz", "assignment", "project", "assessment"] },
  { value: "quizzes", label: "Quizzes", kinds: ["quiz"] },
  { value: "assignments", label: "Assignments", kinds: ["assignment", "project"] },
  { value: "assessments", label: "Assessments", kinds: ["assessment"] },
];

const KIND_LABEL: Record<PracticeActivityKind, string> = {
  quiz: "Quiz",
  assessment: "Assessment",
  assignment: "Assignment",
  project: "Project",
};

const KIND_ICON: Record<PracticeActivityKind, LucideIcon> = {
  quiz: CircleHelp,
  assessment: FileQuestion,
  assignment: ClipboardList,
  project: ClipboardList,
};

const STATUS_LABEL: Record<PracticeActivityStatus, string> = {
  in_progress: "In Progress",
  revision_requested: "Revision Requested",
  overdue: "Overdue",
  not_started: "Not Started",
  not_passed: "Not Passed",
  under_review: "Under Review",
  completed: "Completed",
};

const STATUS_STYLE: Record<PracticeActivityStatus, string> = {
  in_progress: "bg-primary-fixed text-primary",
  revision_requested: "bg-error-container text-on-error-container",
  overdue: "bg-error-container text-on-error-container",
  not_started: "bg-surface-container-high text-on-surface",
  not_passed: "bg-warning-container text-warning",
  under_review: "bg-surface-container-highest text-on-surface-variant",
  completed: "bg-surface-container-highest text-on-surface-variant",
};

function moduleLabel(order: number): string {
  return `Module ${String(order).padStart(2, "0")}`;
}

function nextUpLabel(activity: PracticeActivity): string {
  return activity.actionLabel === "Start" ? `Start ${KIND_LABEL[activity.kind]}` : activity.actionLabel;
}

/** Start/Try Again/Resubmit are outlined, Continue is the filled primary,
 * and the look-only actions (Review, View Submission) are plain links. */
const FILLED_ACTION =
  "shrink-0 rounded-sm bg-primary px-lg py-sm text-center font-body-md text-body-md text-on-primary transition-opacity hover:opacity-90";
const OUTLINED_ACTION =
  "shrink-0 rounded-sm border border-outline bg-surface-container-lowest px-lg py-sm text-center font-body-md text-body-md text-on-surface transition-colors hover:bg-surface-container";

function actionClassName(activity: PracticeActivity): string {
  if (activity.status === "in_progress") return FILLED_ACTION;
  if (activity.status === "completed" || activity.status === "under_review") {
    return "shrink-0 font-body-md text-body-md text-primary hover:underline";
  }
  return OUTLINED_ACTION;
}

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = TABS.find((candidate) => candidate.value === params.type) ?? TABS[0];

  // Two queries, one wave: the activity list and whether the learner has any
  // content access at all (so "no practice yet" and "not enrolled" differ).
  const [activities, grantedEnrollmentCount] = await Promise.all([
    getPracticeActivities(user.id, new Date()),
    prisma.enrollment.count({ where: { userId: user.id, accessState: AccessState.GRANTED } }),
  ]);

  if (grantedEnrollmentCount === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <Target className="h-12 w-12 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Practice</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Practice activities unlock once you have access to a program. Browse the catalog to find your next cohort.
        </p>
        <Link href="/programs" className={buttonVariants({ variant: "default" })}>
          Browse Programs
        </Link>
      </div>
    );
  }

  // The list is already sorted most-urgent-first (getPracticeActivities).
  const nextUp = activities.find((activity) => isActionablePractice(activity.status));
  const completedCount = activities.filter((activity) => activity.status === "completed").length;
  const progressPercent = activities.length === 0 ? 0 : Math.round((completedCount / activities.length) * 100);
  const visible = activities.filter((activity) => tab.kinds.includes(activity.kind));

  return (
    <div className="flex flex-col gap-xl pb-2xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Practice</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Apply what you&apos;ve learned and strengthen your skills.
        </p>
      </header>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
          <Target className="h-12 w-12 text-on-surface-variant" />
          <h2 className="font-headline-md text-headline-md text-on-surface">No practice activities yet</h2>
          <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
            None of your programs has a published quiz, assignment or assessment yet.
          </p>
        </div>
      ) : (
        <>
          {nextUp ? (
            <section className="flex flex-col gap-lg rounded-xl border border-outline-variant bg-surface-container-low p-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-sm">
                <span className="font-label-md text-label-md uppercase tracking-widest text-primary">Next Up</span>
                <h2 className="font-title-lg text-title-lg text-on-surface">{nextUp.title}</h2>
                <p className="flex flex-wrap items-center gap-md font-body-md text-body-md text-on-surface-variant">
                  <span>
                    {nextUp.programName} · {moduleLabel(nextUp.moduleOrder)}
                  </span>
                  {nextUp.questionCount !== null ? (
                    <span className="flex items-center gap-xs">
                      <CircleHelp className="h-4 w-4" />
                      {nextUp.questionCount} question{nextUp.questionCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {nextUp.durationMins !== null ? (
                    <span className="flex items-center gap-xs">
                      <Clock className="h-4 w-4" />
                      {nextUp.durationMins} min
                    </span>
                  ) : null}
                </p>
              </div>
              <Link
                href={nextUp.href}
                className={`${FILLED_ACTION} flex w-full items-center justify-center gap-sm sm:w-auto`}
              >
                {nextUpLabel(nextUp)} <ArrowRight className="h-4 w-4 sm:hidden" />
              </Link>
            </section>
          ) : null}

          <section className="flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-md">
              <h2 className="font-body-lg text-body-lg text-on-surface-variant">Practice Progress</h2>
              <span className="font-body-lg text-body-lg text-on-surface-variant">
                <span className="hidden sm:inline">
                  {completedCount} of {activities.length} activities completed
                </span>
                <span className="text-primary sm:hidden" aria-hidden="true">
                  {completedCount} / {activities.length}
                </span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Practice progress"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest"
            >
              <div className="h-full rounded-full bg-primary-container" style={{ width: `${progressPercent}%` }} />
            </div>
          </section>

          <section className="flex flex-col gap-md">
            <nav aria-label="Activity type" className="flex gap-lg overflow-x-auto border-b border-outline-variant">
              {TABS.map((candidate) => {
                const active = candidate.value === tab.value;
                return (
                  <Link
                    key={candidate.value}
                    href={candidate.value === "all" ? "/learn/practice" : `/learn/practice?type=${candidate.value}`}
                    aria-current={active ? "true" : undefined}
                    className={`-mb-px whitespace-nowrap border-b-2 pb-sm font-body-lg text-body-lg transition-colors ${
                      active
                        ? "border-primary text-on-surface"
                        : "border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {candidate.label}
                  </Link>
                );
              })}
            </nav>

            {visible.length === 0 ? (
              <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
                <p className="font-body-md text-body-md text-on-surface-variant">
                  No {tab.label.toLowerCase()} in your programs yet.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-md md:gap-0">
                {visible.map((activity) => {
                  const Icon = KIND_ICON[activity.kind];
                  return (
                    <li
                      key={activity.key}
                      className="flex flex-col gap-md rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-md md:flex-row md:items-center md:justify-between md:gap-lg md:rounded-none md:border-0 md:border-b md:border-outline-variant/40 md:bg-transparent md:px-md md:py-lg"
                    >
                      <div className="flex min-w-0 flex-col gap-xs">
                        {/* Mobile: type chip + duration sit above the title (practice_hub_mobile) */}
                        <div className="flex items-center justify-between gap-md md:hidden">
                          <span className="rounded-full bg-surface-container-high px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
                            {KIND_LABEL[activity.kind]}
                          </span>
                          {activity.durationMins !== null ? (
                            <span className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant">
                              <Clock className="h-4 w-4" /> {activity.durationMins} min
                            </span>
                          ) : null}
                        </div>
                        <h3 className="font-body-lg text-body-lg text-on-surface">{activity.title}</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant">
                          {activity.programName} · {moduleLabel(activity.moduleOrder)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-lg border-t border-outline-variant/40 pt-md md:justify-end md:border-0 md:pt-0">
                        <div className="flex flex-col gap-xs md:items-end">
                          <span className="hidden items-center gap-xs font-label-md text-label-md text-on-surface-variant md:flex">
                            <Icon className="h-4 w-4" />
                            {KIND_LABEL[activity.kind]}
                            {activity.durationMins !== null ? ` · ${activity.durationMins} min` : ""}
                          </span>
                          <span
                            className={`w-fit whitespace-nowrap rounded px-sm py-xs font-label-md text-label-md ${STATUS_STYLE[activity.status]}`}
                          >
                            {STATUS_LABEL[activity.status]}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-md md:w-40">
                          {activity.retakeHref ? (
                            <Link
                              href={activity.retakeHref}
                              className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:underline"
                            >
                              Retake
                            </Link>
                          ) : null}
                          <Link href={activity.href} className={actionClassName(activity)}>
                            {activity.actionLabel}
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
