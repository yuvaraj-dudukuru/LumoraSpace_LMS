import type { PendingWorkItem } from "@/lib/queries/pending-work";
import type { LessonProgressSummary } from "@/lib/queries/progress";

/** Phase A — the dashboard's "Your Next Step" pick. Pure, no DB, no
 * Date.now(): callers pass the already-fetched pending work, the next
 * incomplete lesson and `now`. Priority, top first:
 *   1. an assignment with a revision requested       (Continue)
 *   2. an overdue assignment                          (Start)
 *   3. an assignment due within DUE_SOON_DAYS with nothing submitted (Start)
 *   4. the next incomplete lesson                     (Start)
 * Assessments never become the next step — they have no due date to rank
 * by; they stay in the pending-work list. A lesson is always "Start": the
 * schema has no "started" signal on a lesson (videoProgressPercent is a
 * resume hint the progress tree doesn't carry), so nothing is invented. */
export const DUE_SOON_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NextStepReason = "revision_requested" | "overdue" | "due_soon" | "next_lesson";

export type NextStep =
  | {
      kind: "assignment";
      reason: "revision_requested" | "overdue" | "due_soon";
      id: string;
      title: string;
      moduleTitle: string;
      dueAt: Date | null;
      estimatedMins: number | null;
      action: "start" | "continue";
      href: string;
    }
  | {
      kind: "lesson";
      reason: "next_lesson";
      id: string;
      title: string;
      moduleId: string;
      durationMins: number | null;
      action: "start";
      href: string;
    }
  | null;

function byDueAt(a: PendingWorkItem, b: PendingWorkItem): number {
  const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
  return a.title.localeCompare(b.title);
}

function assignmentStep(
  item: PendingWorkItem,
  reason: "revision_requested" | "overdue" | "due_soon",
  action: "start" | "continue",
): NextStep {
  return {
    kind: "assignment",
    reason,
    id: item.id,
    title: item.title,
    moduleTitle: item.moduleTitle,
    dueAt: item.dueAt,
    estimatedMins: item.estimatedMins,
    action,
    href: item.href,
  };
}

export function pickNextStep(
  pending: PendingWorkItem[],
  nextLesson: { moduleId: string; lesson: LessonProgressSummary } | null,
  now: Date,
): NextStep {
  const assignments = pending.filter((item) => item.kind === "assignment");

  const revision = assignments.filter((item) => item.state === "revision_requested").sort(byDueAt)[0];
  if (revision) return assignmentStep(revision, "revision_requested", "continue");

  const overdue = assignments.filter((item) => item.state === "overdue").sort(byDueAt)[0];
  if (overdue) return assignmentStep(overdue, "overdue", "start");

  const dueSoon = assignments
    .filter((item) => {
      if (item.state !== "not_started" || item.dueAt === null) return false;
      const untilDue = item.dueAt.getTime() - now.getTime();
      return untilDue >= 0 && untilDue <= DUE_SOON_DAYS * DAY_MS;
    })
    .sort(byDueAt)[0];
  if (dueSoon) return assignmentStep(dueSoon, "due_soon", "start");

  if (nextLesson) {
    return {
      kind: "lesson",
      reason: "next_lesson",
      id: nextLesson.lesson.id,
      title: nextLesson.lesson.title,
      moduleId: nextLesson.moduleId,
      durationMins: nextLesson.lesson.durationMins,
      action: "start",
      href: `/learn/lessons/${nextLesson.lesson.id}`,
    };
  }

  return null;
}
