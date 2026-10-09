import "server-only";
import type { AccessState, BatchStatus, ContentStatus, EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** /admin/batches. ADMIN-only callers, nothing scoped. "Learners" on a batch
 * means enrollments that still hold a seat — CANCELLED and DROPPED rows are
 * left out, the same rule the public enroll action uses for capacity. */

const SEAT_HOLDING: Prisma.EnrollmentWhereInput = { status: { notIn: ["CANCELLED", "DROPPED"] } };

export type AdminBatchCounts = { total: number; active: number; upcoming: number; completed: number };

export type AdminBatchRow = {
  id: string;
  name: string;
  code: string;
  programId: string;
  programName: string;
  startDate: Date;
  endDate: Date;
  status: BatchStatus;
  learnerCount: number;
  capacity: number | null;
  mentors: { id: string; name: string }[];
};

/** `counts` are platform-wide (they don't follow the filter); `rows` do,
 * newest start date first. Search matches batch name, code or program name. */
export async function getBatchesForAdmin(
  filter: { status?: BatchStatus | "all"; search?: string } = {},
): Promise<{ counts: AdminBatchCounts; rows: AdminBatchRow[] }> {
  const [grouped, batches] = await Promise.all([
    prisma.batch.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.batch.findMany({
      where: {
        status: filter.status && filter.status !== "all" ? filter.status : undefined,
        ...(filter.search
          ? {
              OR: [
                { name: { contains: filter.search, mode: "insensitive" } },
                { code: { contains: filter.search, mode: "insensitive" } },
                { program: { name: { contains: filter.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        code: true,
        startDate: true,
        endDate: true,
        status: true,
        capacity: true,
        program: { select: { id: true, name: true } },
        mentors: { select: { mentor: { select: { id: true, name: true } } } },
        _count: { select: { enrollments: { where: SEAT_HOLDING } } },
      },
    }),
  ]);

  const countFor = (status: BatchStatus) => grouped.find((row) => row.status === status)?._count._all ?? 0;

  return {
    counts: {
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
      active: countFor("ACTIVE"),
      upcoming: countFor("UPCOMING"),
      completed: countFor("COMPLETED"),
    },
    rows: batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      code: batch.code,
      programId: batch.program.id,
      programName: batch.program.name,
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: batch.status,
      learnerCount: batch._count.enrollments,
      capacity: batch.capacity,
      mentors: batch.mentors.map((assignment) => assignment.mentor),
    })),
  };
}

export type AdminBatchDetail = {
  id: string;
  name: string;
  code: string;
  status: BatchStatus;
  startDate: Date;
  endDate: Date;
  scheduleNote: string | null;
  capacity: number | null;
  program: { id: string; name: string; description: string; durationWeeks: number; status: ContentStatus };
  /** Seat-holding enrollments (see file comment). */
  learnerCount: number;
  /** Every enrollment row, newest first — cancelled/dropped included so the list is the full record. */
  learners: {
    enrollmentId: string;
    userId: string;
    name: string;
    email: string;
    status: EnrollmentStatus;
    accessState: AccessState;
    progressPercent: number;
  }[];
  mentors: { assignmentId: string; mentorId: string; name: string; title: string | null; roleLabel: string | null }[];
};

export async function getBatchDetailForAdmin(id: string): Promise<AdminBatchDetail | null> {
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      startDate: true,
      endDate: true,
      scheduleNote: true,
      capacity: true,
      program: { select: { id: true, name: true, description: true, durationWeeks: true, status: true } },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          status: true,
          accessState: true,
          progressPercent: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      mentors: {
        orderBy: { mentor: { name: "asc" } },
        select: { id: true, roleLabel: true, mentor: { select: { id: true, name: true, title: true } } },
      },
    },
  });
  if (!batch) return null;

  return {
    id: batch.id,
    name: batch.name,
    code: batch.code,
    status: batch.status,
    startDate: batch.startDate,
    endDate: batch.endDate,
    scheduleNote: batch.scheduleNote,
    capacity: batch.capacity,
    program: batch.program,
    learnerCount: batch.enrollments.filter(
      (enrollment) => enrollment.status !== "CANCELLED" && enrollment.status !== "DROPPED",
    ).length,
    learners: batch.enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      userId: enrollment.user.id,
      name: enrollment.user.name,
      email: enrollment.user.email,
      status: enrollment.status,
      accessState: enrollment.accessState,
      progressPercent: enrollment.progressPercent,
    })),
    mentors: batch.mentors.map((assignment) => ({
      assignmentId: assignment.id,
      mentorId: assignment.mentor.id,
      name: assignment.mentor.name,
      title: assignment.mentor.title,
      roleLabel: assignment.roleLabel,
    })),
  };
}
