import "server-only";
import type { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** /admin/mentors. ADMIN-only callers. Everything about a mentor's load is
 * derived from MentorAssignment → Batch → Enrollment; nothing is stored.
 *
 * Only UPCOMING/ACTIVE batches count as current work: a mentor whose batches
 * are all completed or archived is "Available" again. Learners are distinct
 * seat-holding enrollments (not CANCELLED/DROPPED) across those batches. */

/** There is no capacity field on a mentor, so "workload" needs a yardstick:
 * this many learners reads as a full load (100%). One constant, shown as a
 * percentage — change it here if the team's real ratio differs. */
export const MENTOR_FULL_LOAD_LEARNERS = 30;

export type WorkloadLevel = "Low" | "Moderate" | "High";

/** Pure. */
export function workloadFor(learnerCount: number): { percent: number; level: WorkloadLevel } {
  const percent = Math.round((learnerCount / MENTOR_FULL_LOAD_LEARNERS) * 100);
  return { percent, level: percent >= 80 ? "High" : percent >= 40 ? "Moderate" : "Low" };
}

export type MentorFilter = "all" | "active" | "available" | "assigned";

export type AdminMentorCounts = { total: number; active: number; available: number; assigned: number };

export type AdminMentorRow = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  status: UserStatus;
  /** Distinct programs across current batches. */
  programCount: number;
  /** Current (UPCOMING/ACTIVE) batches. */
  batchCount: number;
  learnerCount: number;
  workloadPercent: number;
  workloadLevel: WorkloadLevel;
};

/** `counts` are over every mentor (they don't follow the filter); `rows` do.
 * active = account ACTIVE; assigned = ≥1 current batch; available = ACTIVE
 * with no current batch. */
export async function getMentorsForAdmin(
  filter: { view?: MentorFilter; search?: string } = {},
): Promise<{ counts: AdminMentorCounts; rows: AdminMentorRow[] }> {
  const mentors = await prisma.user.findMany({
    where: { role: "MENTOR" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      status: true,
      mentorAssignments: {
        where: { batch: { status: { in: ["UPCOMING", "ACTIVE"] } } },
        select: {
          batch: {
            select: {
              programId: true,
              enrollments: { where: { status: { notIn: ["CANCELLED", "DROPPED"] } }, select: { userId: true } },
            },
          },
        },
      },
    },
  });

  const all: AdminMentorRow[] = mentors.map((mentor) => {
    const batches = mentor.mentorAssignments.map((assignment) => assignment.batch);
    const learnerCount = new Set(batches.flatMap((batch) => batch.enrollments.map((enrollment) => enrollment.userId))).size;
    const workload = workloadFor(learnerCount);
    return {
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      title: mentor.title,
      status: mentor.status,
      programCount: new Set(batches.map((batch) => batch.programId)).size,
      batchCount: batches.length,
      learnerCount,
      workloadPercent: workload.percent,
      workloadLevel: workload.level,
    };
  });

  const isAvailable = (row: AdminMentorRow) => row.status === "ACTIVE" && row.batchCount === 0;
  const counts: AdminMentorCounts = {
    total: all.length,
    active: all.filter((row) => row.status === "ACTIVE").length,
    available: all.filter(isAvailable).length,
    assigned: all.filter((row) => row.batchCount > 0).length,
  };

  const needle = filter.search?.toLowerCase();
  const rows = all.filter((row) => {
    if (needle && !row.name.toLowerCase().includes(needle) && !row.email.toLowerCase().includes(needle)) return false;
    switch (filter.view) {
      case "active":
        return row.status === "ACTIVE";
      case "available":
        return isAvailable(row);
      case "assigned":
        return row.batchCount > 0;
      default:
        return true;
    }
  });

  return { counts, rows };
}
