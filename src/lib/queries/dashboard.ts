import "server-only";
import { AccessState, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProgramProgress, findNextIncompleteLesson, type ProgramProgress } from "@/lib/queries/progress";

export type NextAssignment = {
  id: string;
  title: string;
  dueAt: Date;
  estimatedMins: number | null;
};

export type ActivityItem =
  | { kind: "lesson_completed"; label: string; occurredAt: Date }
  | { kind: "assignment_submitted"; label: string; occurredAt: Date };

export type DashboardData = {
  learnerName: string;
  streakDays: number;
  enrollment: { id: string; programId: string; programName: string };
  progress: ProgramProgress;
  nextLesson: { moduleId: string; lessonId: string; lessonTitle: string } | null;
  nextAssignment: NextAssignment | null;
  recentActivity: ActivityItem[];
} | null; // null => learner has no GRANTED/ACTIVE enrollment (empty state)

/** Everything /learn needs, in one shot per sub-query — no page-level looping. */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, streakDays: true },
  });

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      status: EnrollmentStatus.ACTIVE,
      accessState: AccessState.GRANTED,
    },
    orderBy: { enrolledAt: "desc" },
    select: { id: true, programId: true, program: { select: { name: true } } },
  });

  if (!enrollment) return null;

  const progress = await getProgramProgress(enrollment.id);
  const next = findNextIncompleteLesson(progress);

  const [nextAssignment, completedLessons, submissions] = await Promise.all([
    prisma.assignment.findFirst({
      where: {
        module: { programId: enrollment.programId },
        dueAt: { not: null },
        // M5a — a NOT_STARTED row is a seed placeholder, not a real
        // submission (see queries/assignments.ts); excluded here so it
        // doesn't hide an assignment nothing has really been submitted for.
        submissions: { none: { enrollmentId: enrollment.id, status: { not: "NOT_STARTED" } } },
      },
      orderBy: { dueAt: "asc" },
      select: { id: true, title: true, dueAt: true, estimatedMins: true },
    }),
    prisma.lessonProgress.findMany({
      where: { enrollmentId: enrollment.id, completed: true, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: { completedAt: true, lesson: { select: { title: true } } },
    }),
    prisma.submission.findMany({
      where: { enrollmentId: enrollment.id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: { submittedAt: true, assignment: { select: { title: true } } },
    }),
  ]);

  const recentActivity: ActivityItem[] = [
    ...completedLessons
      .filter((item): item is typeof item & { completedAt: Date } => item.completedAt !== null)
      .map((item) => ({
        kind: "lesson_completed" as const,
        label: item.lesson.title,
        occurredAt: item.completedAt,
      })),
    ...submissions
      .filter((item): item is typeof item & { submittedAt: Date } => item.submittedAt !== null)
      .map((item) => ({
        kind: "assignment_submitted" as const,
        label: item.assignment.title,
        occurredAt: item.submittedAt,
      })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 5);

  return {
    learnerName: user.name,
    streakDays: user.streakDays,
    enrollment: {
      id: enrollment.id,
      programId: enrollment.programId,
      programName: enrollment.program.name,
    },
    progress,
    nextLesson: next
      ? { moduleId: next.moduleId, lessonId: next.lesson.id, lessonTitle: next.lesson.title }
      : null,
    nextAssignment:
      nextAssignment && nextAssignment.dueAt
        ? {
            id: nextAssignment.id,
            title: nextAssignment.title,
            dueAt: nextAssignment.dueAt,
            estimatedMins: nextAssignment.estimatedMins,
          }
        : null,
    recentActivity,
  };
}
