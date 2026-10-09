import "server-only";
import type { ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Numbers behind /admin (dashboard) and /admin/analytics. ADMIN-only
 * callers, nothing scoped. EVERYTHING here is derived from rows that already
 * exist (enrollments, lesson progress, submissions, attempts, certificates,
 * payments, reviews) — there is no analytics/event table, so there is no
 * page-view, session or "time spent" data and none is implied.
 *
 * "Activity" = a learner completed a lesson, submitted an assignment or
 * started an assessment attempt — the same three signals the mentor screens
 * use for "last active" (docs/CONTRACTS.md). */

export const ANALYTICS_RANGE_DAYS = [7, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_DAYS)[number];
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeDays = 30;

const DAY_MS = 86_400_000;

/** Days per chart point, so every range draws 7–10 points. */
const BUCKET_DAYS: Record<AnalyticsRangeDays, number> = { 7: 1, 30: 3, 90: 10 };

export function parseAnalyticsRange(raw: string | undefined): AnalyticsRangeDays {
  return ANALYTICS_RANGE_DAYS.find((days) => String(days) === raw) ?? DEFAULT_ANALYTICS_RANGE;
}

type Bucket = { start: number; end: number; label: string };

/** Pure. Equal buckets covering [now − rangeDays, now], oldest first. */
export function buildBuckets(rangeDays: AnalyticsRangeDays, now: Date): Bucket[] {
  const size = BUCKET_DAYS[rangeDays] * DAY_MS;
  const count = Math.ceil(rangeDays / BUCKET_DAYS[rangeDays]);
  const end = now.getTime();
  return Array.from({ length: count }, (_, index) => {
    const bucketEnd = end - (count - 1 - index) * size;
    const bucketStart = bucketEnd - size;
    return {
      start: bucketStart,
      end: bucketEnd,
      label: new Date(bucketStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });
}

function bucketIndex(buckets: Bucket[], time: number): number {
  // (start, end] so an event stamped exactly "now" lands in the last bucket.
  return buckets.findIndex((bucket) => time > bucket.start && time <= bucket.end);
}

/** Pure. null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type ActivityEvent = { enrollmentId: string; at: Date };

/** Every activity signal since `since`, as (enrollment, time) pairs. */
async function getActivityEvents(since: Date): Promise<ActivityEvent[]> {
  const [lessons, submissions, attempts] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: { completed: true, completedAt: { gte: since } },
      select: { enrollmentId: true, completedAt: true },
    }),
    prisma.submission.findMany({
      where: { submittedAt: { gte: since } },
      select: { enrollmentId: true, submittedAt: true },
    }),
    prisma.attempt.findMany({ where: { startedAt: { gte: since } }, select: { enrollmentId: true, startedAt: true } }),
  ]);
  const events: ActivityEvent[] = [];
  for (const row of lessons) if (row.completedAt) events.push({ enrollmentId: row.enrollmentId, at: row.completedAt });
  for (const row of submissions) if (row.submittedAt) events.push({ enrollmentId: row.enrollmentId, at: row.submittedAt });
  for (const row of attempts) events.push({ enrollmentId: row.enrollmentId, at: row.startedAt });
  return events;
}

export type ActivityChart = {
  labels: string[];
  /** Enrollments created in each bucket. */
  newEnrollments: number[];
  /** Distinct enrollments with any activity signal in each bucket. */
  activeLearners: number[];
  /** Enrollments completed in each bucket. */
  completions: number[];
};

async function getActivityChart(rangeDays: AnalyticsRangeDays, now: Date, events: ActivityEvent[]): Promise<ActivityChart> {
  const buckets = buildBuckets(rangeDays, now);
  const since = new Date(buckets[0].start);
  const [created, completed] = await Promise.all([
    prisma.enrollment.findMany({ where: { enrolledAt: { gte: since } }, select: { enrolledAt: true } }),
    prisma.enrollment.findMany({ where: { completedAt: { gte: since } }, select: { completedAt: true } }),
  ]);

  const newEnrollments = buckets.map(() => 0);
  const completions = buckets.map(() => 0);
  const active = buckets.map(() => new Set<string>());
  for (const row of created) {
    const index = bucketIndex(buckets, row.enrolledAt.getTime());
    if (index >= 0) newEnrollments[index] += 1;
  }
  for (const row of completed) {
    const index = row.completedAt ? bucketIndex(buckets, row.completedAt.getTime()) : -1;
    if (index >= 0) completions[index] += 1;
  }
  for (const event of events) {
    const index = bucketIndex(buckets, event.at.getTime());
    if (index >= 0) active[index].add(event.enrollmentId);
  }

  return {
    labels: buckets.map((bucket) => bucket.label),
    newEnrollments,
    activeLearners: active.map((set) => set.size),
    completions,
  };
}

export type ProgramPerformanceRow = {
  id: string;
  name: string;
  status: ContentStatus;
  /** Seat-holding enrollments (not CANCELLED/DROPPED). */
  enrollments: number;
  active: number;
  completed: number;
  /** completed ÷ enrollments, 0–100; 0 when nobody is enrolled. */
  completionPercent: number;
  /** Mean of the cached Enrollment.progressPercent over seat-holding rows. */
  averageProgressPercent: number;
  /** VALID certificates. */
  certificates: number;
};

export async function getProgramPerformance(): Promise<ProgramPerformanceRow[]> {
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      enrollments: {
        where: { status: { notIn: ["CANCELLED", "DROPPED"] } },
        select: { status: true, progressPercent: true },
      },
      _count: { select: { certificates: { where: { status: "VALID" } } } },
    },
  });

  return programs
    .map((program) => {
      const total = program.enrollments.length;
      const completed = program.enrollments.filter((enrollment) => enrollment.status === "COMPLETED").length;
      const progressSum = program.enrollments.reduce((sum, enrollment) => sum + enrollment.progressPercent, 0);
      return {
        id: program.id,
        name: program.name,
        status: program.status,
        enrollments: total,
        active: program.enrollments.filter((enrollment) => enrollment.status === "ACTIVE").length,
        completed,
        completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
        averageProgressPercent: total === 0 ? 0 : Math.round(progressSum / total),
        certificates: program._count.certificates,
      };
    })
    .sort((a, b) => b.enrollments - a.enrollments || a.name.localeCompare(b.name));
}

export type AttentionCounts = {
  /** SUBMITTED + UNDER_REVIEW submissions. */
  pendingReviews: number;
  /** ACTIVE enrollments whose batch has no mentor (or that have no batch). */
  learnersWithoutMentor: number;
  /** Enrollments with accessState AWAITING. */
  awaitingAccess: number;
};

export async function getAttentionCounts(): Promise<AttentionCounts> {
  const [pendingReviews, learnersWithoutMentor, awaitingAccess] = await Promise.all([
    prisma.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.enrollment.count({
      where: { status: "ACTIVE", OR: [{ batchId: null }, { batch: { mentors: { none: {} } } }] },
    }),
    prisma.enrollment.count({ where: { accessState: "AWAITING" } }),
  ]);
  return { pendingReviews, learnersWithoutMentor, awaitingAccess };
}

export type RecentActivityItem = {
  id: string;
  kind: "enrollment" | "payment" | "certificate" | "review";
  title: string;
  detail: string;
  at: Date;
  href: string;
};

const RECENT_ACTIVITY_LIMIT = 6;

/** The newest few of four real event kinds, merged. Derived on read. */
async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const take = RECENT_ACTIVITY_LIMIT;
  const [enrollments, payments, certificates, reviews] = await Promise.all([
    prisma.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take,
      select: { id: true, enrolledAt: true, user: { select: { name: true, email: true } }, program: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESSFUL" },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, createdAt: true, amount: true, currency: true, user: { select: { name: true } } },
    }),
    prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      take,
      select: { id: true, issuedAt: true, user: { select: { name: true } }, program: { select: { name: true } } },
    }),
    prisma.review.findMany({
      where: { reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
      take,
      select: {
        id: true,
        reviewedAt: true,
        mentor: { select: { name: true } },
        submission: { select: { id: true, assignment: { select: { title: true } } } },
      },
    }),
  ]);

  const items: RecentActivityItem[] = [
    ...enrollments.map((row) => ({
      id: `enrollment:${row.id}`,
      kind: "enrollment" as const,
      title: "New learner enrolled",
      detail: `${row.user.name} · ${row.program.name}`,
      at: row.enrolledAt,
      href: `/admin/enrollments?search=${encodeURIComponent(row.user.email)}`,
    })),
    ...payments.map((row) => ({
      id: `payment:${row.id}`,
      kind: "payment" as const,
      title: "Payment received",
      detail: `${row.user.name} · ${Number(row.amount).toLocaleString("en-IN")} ${row.currency}`,
      at: row.createdAt,
      href: `/admin/payments/${row.id}`,
    })),
    ...certificates.map((row) => ({
      id: `certificate:${row.id}`,
      kind: "certificate" as const,
      title: "Certificate issued",
      detail: `${row.user.name} · ${row.program.name}`,
      at: row.issuedAt,
      href: `/admin/certificates/${row.id}`,
    })),
    ...reviews.flatMap((row) =>
      row.reviewedAt
        ? [
            {
              id: `review:${row.id}`,
              kind: "review" as const,
              title: "Assignment reviewed",
              detail: `${row.submission.assignment.title} · by ${row.mentor.name}`,
              at: row.reviewedAt,
              href: `/mentor/submissions/${row.submission.id}`,
            },
          ]
        : [],
    ),
  ];

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, RECENT_ACTIVITY_LIMIT);
}

export type AdminDashboard = {
  rangeDays: AnalyticsRangeDays;
  attention: AttentionCounts;
  totalLearners: number;
  /** Distinct learners with an ACTIVE, GRANTED enrollment. */
  activeLearners: number;
  publishedPrograms: number;
  /** ACTIVE accounts with role MENTOR. */
  activeMentors: number;
  chart: ActivityChart;
  /** In the selected range. */
  lessonsCompleted: number;
  assignmentsSubmitted: number;
  programs: ProgramPerformanceRow[];
  recentActivity: RecentActivityItem[];
};

export async function getAdminDashboard(rangeDays: AnalyticsRangeDays, now: Date): Promise<AdminDashboard> {
  const since = new Date(now.getTime() - rangeDays * DAY_MS);
  const events = await getActivityEvents(since);

  const [
    attention,
    totalLearners,
    activeLearnerRows,
    publishedPrograms,
    activeMentors,
    chart,
    lessonsCompleted,
    assignmentsSubmitted,
    programs,
    recentActivity,
  ] = await Promise.all([
    getAttentionCounts(),
    prisma.user.count({ where: { role: "LEARNER" } }),
    prisma.enrollment.findMany({
      where: { status: "ACTIVE", accessState: "GRANTED" },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.program.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count({ where: { role: "MENTOR", status: "ACTIVE" } }),
    getActivityChart(rangeDays, now, events),
    prisma.lessonProgress.count({ where: { completed: true, completedAt: { gte: since } } }),
    prisma.submission.count({ where: { submittedAt: { gte: since } } }),
    getProgramPerformance(),
    getRecentActivity(),
  ]);

  return {
    rangeDays,
    attention,
    totalLearners,
    activeLearners: activeLearnerRows.length,
    publishedPrograms,
    activeMentors,
    chart,
    lessonsCompleted,
    assignmentsSubmitted,
    programs,
    recentActivity,
  };
}

export type Trend = { value: number; changePercent: number | null };

export type AnalyticsAlert = { id: string; tone: "error" | "warning"; message: string; linkLabel: string; href: string };

export type AdminAnalytics = {
  rangeDays: AnalyticsRangeDays;
  /** Distinct enrollments with activity in the range, vs the previous equal period. */
  activeLearners: Trend;
  newEnrollments: Trend;
  certificatesIssued: Trend;
  /** COMPLETED ÷ seat-holding enrollments, all time. No history is kept, so no trend. */
  completionRatePercent: number;
  chart: ActivityChart;
  alerts: AnalyticsAlert[];
  programs: ProgramPerformanceRow[];
};

/** A submission still unreviewed after this long counts as backlog. */
export const REVIEW_BACKLOG_HOURS = 48;
/** A module whose lesson-completion share is this many points below the module before it is flagged. */
export const DROP_OFF_POINTS = 15;

/** Module-to-module drop-off, per program: of everything an ACTIVE, GRANTED
 * enrollment could have completed in a module (lessons × enrollments), what
 * share is done — flagged when it falls DROP_OFF_POINTS below the previous
 * module's. Returns the single worst case per program. */
async function getDropOffAlerts(): Promise<AnalyticsAlert[]> {
  const programs = await prisma.program.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      enrollments: { where: { status: "ACTIVE", accessState: "GRANTED" }, select: { id: true } },
      modules: {
        where: { status: "PUBLISHED" },
        orderBy: { order: "asc" },
        select: {
          order: true,
          title: true,
          lessons: {
            select: { progress: { where: { completed: true, enrollment: { status: "ACTIVE", accessState: "GRANTED" } }, select: { id: true } } },
          },
        },
      },
    },
  });

  const alerts: AnalyticsAlert[] = [];
  for (const program of programs) {
    const learners = program.enrollments.length;
    if (learners === 0) continue;
    const shares = program.modules
      .filter((programModule) => programModule.lessons.length > 0)
      .map((programModule) => {
        const done = programModule.lessons.reduce((sum, lesson) => sum + lesson.progress.length, 0);
        return { ...programModule, percent: Math.round((done / (programModule.lessons.length * learners)) * 100) };
      });
    let worst: { order: number; title: string; drop: number } | null = null;
    for (let index = 1; index < shares.length; index++) {
      const drop = shares[index - 1].percent - shares[index].percent;
      if (drop >= DROP_OFF_POINTS && (worst === null || drop > worst.drop)) {
        worst = { order: shares[index].order, title: shares[index].title, drop };
      }
    }
    if (worst) {
      alerts.push({
        id: `dropoff:${program.id}`,
        tone: "error",
        message: `${program.name}: Module ${String(worst.order).padStart(2, "0")} (${worst.title}) is ${worst.drop} points behind the module before it.`,
        linkLabel: "View Curriculum",
        href: `/admin/curriculum?program=${program.id}`,
      });
    }
  }
  return alerts;
}

export async function getAdminAnalytics(rangeDays: AnalyticsRangeDays, now: Date): Promise<AdminAnalytics> {
  const since = new Date(now.getTime() - rangeDays * DAY_MS);
  const previousSince = new Date(now.getTime() - 2 * rangeDays * DAY_MS);
  const backlogBefore = new Date(now.getTime() - REVIEW_BACKLOG_HOURS * 3_600_000);

  const events = await getActivityEvents(previousSince);
  const distinctIn = (from: Date, to: Date) =>
    new Set(events.filter((event) => event.at > from && event.at <= to).map((event) => event.enrollmentId)).size;

  const [
    newEnrollments,
    previousEnrollments,
    certificates,
    previousCertificates,
    seatHolding,
    completed,
    chart,
    backlog,
    attention,
    dropOff,
    programs,
  ] = await Promise.all([
    prisma.enrollment.count({ where: { enrolledAt: { gte: since } } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: previousSince, lt: since } } }),
    prisma.certificate.count({ where: { issuedAt: { gte: since } } }),
    prisma.certificate.count({ where: { issuedAt: { gte: previousSince, lt: since } } }),
    prisma.enrollment.count({ where: { status: { notIn: ["CANCELLED", "DROPPED"] } } }),
    prisma.enrollment.count({ where: { status: "COMPLETED" } }),
    getActivityChart(
      rangeDays,
      now,
      events.filter((event) => event.at > since),
    ),
    prisma.submission.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, submittedAt: { lt: backlogBefore } },
    }),
    getAttentionCounts(),
    getDropOffAlerts(),
    getProgramPerformance(),
  ]);

  const alerts: AnalyticsAlert[] = [...dropOff];
  if (backlog > 0) {
    alerts.push({
      id: "backlog",
      tone: "warning",
      message: `${backlog} submission${backlog === 1 ? " has" : "s have"} waited more than ${REVIEW_BACKLOG_HOURS} hours for a review.`,
      linkLabel: "View Reviews",
      href: "/mentor/submissions?filter=pending",
    });
  }
  if (attention.learnersWithoutMentor > 0) {
    alerts.push({
      id: "mentorless",
      tone: "warning",
      message: `${attention.learnersWithoutMentor} active learner${attention.learnersWithoutMentor === 1 ? " is" : "s are"} in a batch with no mentor.`,
      linkLabel: "View Batches",
      href: "/admin/batches?status=ACTIVE",
    });
  }
  if (attention.awaitingAccess > 0) {
    alerts.push({
      id: "awaiting",
      tone: "warning",
      message: `${attention.awaitingAccess} enrollment${attention.awaitingAccess === 1 ? " is" : "s are"} waiting for access.`,
      linkLabel: "Review Enrollments",
      href: "/admin/enrollments?accessState=AWAITING",
    });
  }

  const activeNow = distinctIn(since, now);
  return {
    rangeDays,
    activeLearners: { value: activeNow, changePercent: percentChange(activeNow, distinctIn(previousSince, since)) },
    newEnrollments: { value: newEnrollments, changePercent: percentChange(newEnrollments, previousEnrollments) },
    certificatesIssued: { value: certificates, changePercent: percentChange(certificates, previousCertificates) },
    completionRatePercent: seatHolding === 0 ? 0 : Math.round((completed / seatHolding) * 100),
    chart,
    alerts,
    programs,
  };
}
