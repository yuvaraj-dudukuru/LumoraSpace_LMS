import Link from "next/link";
import { AccessState } from "@prisma/client";
import { GraduationCap, Award, Clock, Flame, ArrowRight, PlayCircle, FileText, HelpCircle } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getEnrollmentsForUser } from "@/lib/queries/enrollments";
import { getProgramProgress, findNextIncompleteLesson, type ProgramProgress } from "@/lib/queries/progress";
import { getLearningHoursStats } from "@/lib/queries/activity";
import { getCertificatesForUser, type LearnerCertificate } from "@/lib/queries/certificates";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { deriveLearnerStatus, type LearnerStatus } from "@/lib/learner-status";
import { LearnerStatusPill } from "@/components/learner-status-pill";
import { PendingWorkList } from "@/components/pending-work-list";
import { getPendingWork, sortPendingWork, type PendingWorkItem } from "@/lib/queries/pending-work";
import { WeeklyActivityChart } from "./weekly-activity-chart";

type ActiveCourseCard = {
  enrollmentId: string;
  programId: string;
  programName: string;
  progress: ProgramProgress;
  learnerStatus: LearnerStatus | null;
  pendingWork: PendingWorkItem[];
  currentModuleTitle: string | null;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  nextLessonType: string | null;
  nextLessonDuration: number | null;
};

export default async function ProgressPage() {
  const user = await requireUser();

  const [enrollments, activityStats, certificates] = await Promise.all([
    getEnrollmentsForUser(user.id),
    getLearningHoursStats(user.id),
    getCertificatesForUser(user.id),
  ]);

  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <GraduationCap className="h-12 w-12 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">No Programs Yet</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          You&apos;re not enrolled in any programs. Browse our catalog to get started on your learning journey.
        </p>
        <Link href="/programs" className={buttonVariants({ variant: "default" })}>
          Browse Programs
        </Link>
      </div>
    );
  }

  const grantedEnrollments = enrollments.filter((e) => e.accessState === AccessState.GRANTED);

  const now = new Date();

  const progressResults = await Promise.all(
    grantedEnrollments.map(async (enrollment) => {
      // Two queries per enrollment, same wave — no extra round trip.
      const [progress, pendingWork] = await Promise.all([
        getProgramProgress(enrollment.id),
        getPendingWork(enrollment.id, now),
      ]);
      const next = findNextIncompleteLesson(progress);
      const currentModule = next
        ? progress.modules.find((m) => m.moduleId === next.moduleId)
        : undefined;
      const learnerStatus = enrollment.batch
        ? deriveLearnerStatus({
            batchStart: enrollment.batch.startDate,
            batchEnd: enrollment.batch.endDate,
            now,
            progressPercent: progress.overallPercent,
            enrollmentStatus: enrollment.status,
          })
        : null;

      return {
        enrollmentId: enrollment.id,
        programId: enrollment.programId,
        programName: enrollment.program.name,
        progress,
        learnerStatus,
        pendingWork: sortPendingWork(pendingWork),
        currentModuleTitle: currentModule?.title ?? null,
        nextLessonId: next?.lesson.id ?? null,
        nextLessonTitle: next?.lesson.title ?? null,
        nextLessonType: next?.lesson.type ?? null,
        nextLessonDuration: next?.lesson.durationMins ?? null,
      } satisfies ActiveCourseCard;
    }),
  );

  const completedCourses = progressResults.filter((c) => c.progress.overallPercent === 100).length;

  // Find the first course with remaining work for the milestone CTA
  const nextMilestoneCourse = progressResults.find(
    (c) => c.progress.overallPercent < 100 && c.progress.overallPercent > 0,
  );
  const remainingModules = nextMilestoneCourse
    ? nextMilestoneCourse.progress.modules.filter((m) => m.percent < 100).length
    : 0;

  return (
    <div className="flex flex-col gap-2xl pb-2xl">
      {/* Hero */}
      <header>
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Progress Overview
        </h1>
        <p className="mt-sm font-body-lg text-body-lg text-on-surface-variant">
          Track your learning journey and skill development.
        </p>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-md md:grid-cols-4">
        <StatCard
          icon={<GraduationCap className="h-7 w-7 text-primary" />}
          value={completedCourses}
          label="Courses Completed"
        />
        <StatCard
          icon={<Award className="h-7 w-7 text-secondary" />}
          value={certificates.length}
          label="Certificates Earned"
        />
        <StatCard
          icon={<Clock className="h-7 w-7 text-tertiary" />}
          value={activityStats.totalHours}
          label="Est. Learning Hours"
        />
        <StatCard
          icon={<Flame className="h-7 w-7 text-primary" />}
          value={`${user.streakDays}${user.streakDays === 1 ? " Day" : " Days"}`}
          label="Current Streak"
        />
      </section>

      {/* Weekly Activity chart */}
      <section>
        <div className="mb-lg flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Weekly Activity</h2>
          <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
            Last 7 Days
          </span>
        </div>
        <WeeklyActivityChart data={activityStats.weeklyActivity} />
      </section>

      {/* Active Courses + Sidebar */}
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <section className="flex flex-col gap-md lg:col-span-2">
          <h2 className="mb-sm font-headline-md text-headline-md text-on-surface">Active Courses</h2>
          {progressResults.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              No active courses with content access.
            </p>
          ) : (
            progressResults.map((card) => (
              <div key={card.enrollmentId} className="flex flex-col gap-md">
                <CourseProgressCard card={card} />
                <div className="flex flex-col gap-sm rounded-xl border border-outline-variant/30 p-md">
                  <h3 className="font-title-lg text-title-lg text-on-surface">Pending work</h3>
                  <PendingWorkList
                    items={card.pendingWork}
                    emptyMessage="No assignments or graded assessments in this program yet."
                  />
                </div>
              </div>
            ))
          )}
        </section>

        <div className="flex flex-col gap-xl">
          {/* Certificates */}
          <CertificatesSection certificates={certificates} />
        </div>
      </div>

      {/* Next Milestone CTA */}
      {nextMilestoneCourse ? (
        <section className="relative overflow-hidden rounded-xl bg-primary-container p-lg text-on-primary-container">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-md md:flex-row md:items-center">
            <div>
              <h2 className="font-title-lg text-title-lg">Next Milestone</h2>
              <p className="mt-xs font-body-md text-body-md opacity-90">
                Complete {remainingModules} more module{remainingModules !== 1 ? "s" : ""} in
                &lsquo;{nextMilestoneCourse.programName}&rsquo; to earn your next badge.
              </p>
            </div>
            <Link
              href={
                nextMilestoneCourse.nextLessonId
                  ? `/learn/lessons/${nextMilestoneCourse.nextLessonId}`
                  : `/learn/programs/${nextMilestoneCourse.programId}`
              }
              className="shrink-0 whitespace-nowrap rounded-full bg-on-primary-container px-lg py-sm font-label-md text-label-md text-primary-container transition-colors hover:opacity-90"
            >
              Continue Course
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ─── Sub-components (co-located, server-only) ─── */

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex h-32 flex-col justify-between rounded-xl bg-surface-container-low p-md">
      {icon}
      <div>
        <div className="font-headline-md text-headline-md text-on-surface">{value}</div>
        <div className="font-label-md text-label-md text-on-surface-variant">{label}</div>
      </div>
    </div>
  );
}

function CourseProgressCard({ card }: { card: ActiveCourseCard }) {
  const LessonIcon =
    card.nextLessonType === "VIDEO"
      ? PlayCircle
      : card.nextLessonType === "READING"
        ? FileText
        : HelpCircle;

  return (
    <Link
      href={
        card.nextLessonId
          ? `/learn/lessons/${card.nextLessonId}`
          : `/learn/programs/${card.programId}`
      }
      className="group cursor-pointer rounded-xl bg-surface-container-low p-lg transition-colors hover:bg-surface-container"
    >
      <div className="mb-md flex items-start justify-between">
        <div>
          <h3 className="font-title-lg text-title-lg text-on-surface transition-colors group-hover:text-primary">
            {card.programName}
          </h3>
          {card.currentModuleTitle ? (
            <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
              {card.currentModuleTitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-xs">
          {card.learnerStatus ? <LearnerStatusPill status={card.learnerStatus} /> : null}
          <span
            className={`shrink-0 rounded-full px-sm py-xs font-label-md text-label-md ${
              card.progress.overallPercent >= 50
                ? "bg-primary-fixed text-primary"
                : "bg-surface-container-highest text-on-surface-variant"
            }`}
          >
            {card.progress.overallPercent}%
          </span>
        </div>
      </div>

      <div className="mb-sm h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
          style={{ width: `${card.progress.overallPercent}%` }}
        />
      </div>

      {card.nextLessonTitle ? (
        <div className="mt-md flex items-center gap-sm text-on-surface-variant">
          <LessonIcon className="h-4.5 w-4.5 shrink-0" />
          <span className="font-label-md text-label-md">
            Next: {card.nextLessonTitle}
            {card.nextLessonDuration ? ` (${card.nextLessonDuration}m)` : ""}
          </span>
        </div>
      ) : (
        <p className="mt-md font-label-md text-label-md text-on-surface-variant">
          All lessons completed
        </p>
      )}
    </Link>
  );
}

function CertificatesSection({ certificates }: { certificates: LearnerCertificate[] }) {
  if (certificates.length === 0) {
    return (
      <section>
        <h2 className="mb-md font-title-lg text-title-lg text-on-surface">Recent Certificates</h2>
        <div className="flex flex-col items-center gap-sm rounded-xl bg-surface-container-low p-lg text-center">
          <Award className="h-8 w-8 text-on-surface-variant" />
          <p className="font-body-md text-body-md text-on-surface-variant">
            No certificates earned yet. Complete a program to earn your first certificate.
          </p>
        </div>
      </section>
    );
  }

  const shown = certificates.slice(0, 2);

  return (
    <section>
      <h2 className="mb-md font-title-lg text-title-lg text-on-surface">Recent Certificates</h2>
      <div className="flex flex-col gap-sm">
        {shown.map((cert) => (
          <Link
            key={cert.id}
            href={`/learn/certificates/${cert.id}`}
            className="flex items-center gap-md rounded-xl bg-surface-container-low p-md transition-colors hover:bg-surface-container"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-secondary/10">
              <Award className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface">
                {cert.program.name}
              </div>
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                Issued: {formatDate(cert.issuedAt)}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {certificates.length > 2 ? (
        <Link
          href="/learn/certificates"
          className="mt-md flex items-center gap-xs font-label-md text-label-md text-primary hover:underline"
        >
          View all certificates <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </section>
  );
}
