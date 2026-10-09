import "server-only";
import type {
  AccessState,
  BatchStatus,
  CertificateStatus,
  ContentStatus,
  EnrollmentStatus,
  ProgramFormat,
  ProgramLevel,
  Role,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminDashboardStats = {
  totalLearners: number;
  activeEnrollments: number;
  awaitingEnrollments: number;
  pendingReviews: number;
  certificatesIssued: number;
};

/** All counts are direct, unscoped queries — this route is already
 * requireRole(ADMIN)-only, so there's no batchIds threading like the M5b
 * mentor queries; an admin simply sees the whole platform. */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [totalLearners, activeEnrollments, awaitingEnrollments, pendingReviews, certificatesIssued] =
    await Promise.all([
      prisma.user.count({ where: { role: "LEARNER" } }),
      prisma.enrollment.count({ where: { status: "ACTIVE" } }),
      prisma.enrollment.count({ where: { accessState: "AWAITING" } }),
      prisma.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.certificate.count(),
    ]);

  return { totalLearners, activeEnrollments, awaitingEnrollments, pendingReviews, certificatesIssued };
}

export type AdminEnrollmentCounts = {
  total: number;
  active: number;
  pending: number;
  completed: number;
  /** CANCELLED + DROPPED — both are "no longer enrolled". */
  cancelled: number;
  awaitingAccess: number;
};

/** Platform-wide, for the /admin/enrollments stat cards (they don't follow the filter). */
export async function getEnrollmentCounts(): Promise<AdminEnrollmentCounts> {
  const [byStatus, awaitingAccess] = await Promise.all([
    prisma.enrollment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.enrollment.count({ where: { accessState: "AWAITING" } }),
  ]);
  const countFor = (status: EnrollmentStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
  return {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    active: countFor("ACTIVE"),
    pending: countFor("PENDING"),
    completed: countFor("COMPLETED"),
    cancelled: countFor("CANCELLED") + countFor("DROPPED"),
    awaitingAccess,
  };
}

export type AdminEnrollmentRow = {
  id: string;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  programName: string;
  batchName: string | null;
  batchCode: string | null;
  status: EnrollmentStatus;
  accessState: AccessState;
  progressPercent: number;
  enrolledAt: Date;
};

export type EnrollmentFilter = {
  accessState?: AccessState | "all";
  /** "CANCELLED" also matches DROPPED — the screen has one "Cancelled" tab for both. */
  status?: EnrollmentStatus | "all";
  /** Learner name/email, program name, or batch name/code. */
  search?: string;
};

/** Default view (no filter args) sorts AWAITING first — that's the queue an
 * admin actually works day to day. `orderBy` can't express "this enum value
 * first" directly, so the AWAITING-first ordering is applied in JS after the
 * DB query, not via Prisma's orderBy. */
export async function getEnrollmentsForAdmin(filter: EnrollmentFilter = {}): Promise<AdminEnrollmentRow[]> {
  const contains = filter.search ? { contains: filter.search, mode: "insensitive" as const } : undefined;
  const enrollments = await prisma.enrollment.findMany({
    where: {
      accessState: filter.accessState && filter.accessState !== "all" ? filter.accessState : undefined,
      status:
        !filter.status || filter.status === "all"
          ? undefined
          : filter.status === "CANCELLED"
            ? { in: ["CANCELLED", "DROPPED"] }
            : filter.status,
      ...(contains
        ? {
            OR: [
              { user: { name: contains } },
              { user: { email: contains } },
              { program: { name: contains } },
              { batch: { name: contains } },
              { batch: { code: contains } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      accessState: true,
      progressPercent: true,
      enrolledAt: true,
      user: { select: { id: true, name: true, email: true } },
      program: { select: { name: true } },
      batch: { select: { name: true, code: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const rows: AdminEnrollmentRow[] = enrollments.map((enrollment) => ({
    id: enrollment.id,
    userId: enrollment.user.id,
    learnerName: enrollment.user.name,
    learnerEmail: enrollment.user.email,
    programName: enrollment.program.name,
    batchName: enrollment.batch?.name ?? null,
    batchCode: enrollment.batch?.code ?? null,
    status: enrollment.status,
    accessState: enrollment.accessState,
    progressPercent: enrollment.progressPercent,
    enrolledAt: enrollment.enrolledAt,
  }));

  return rows.sort((a, b) => {
    if (a.accessState === "AWAITING" && b.accessState !== "AWAITING") return -1;
    if (a.accessState !== "AWAITING" && b.accessState === "AWAITING") return 1;
    return b.enrolledAt.getTime() - a.enrolledAt.getTime();
  });
}

export type AdminUserCounts = { total: number; learners: number; mentors: number; admins: number };

/** Platform-wide, for the /admin/users stat cards. */
export async function getUserCounts(): Promise<AdminUserCounts> {
  const byRole = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  const countFor = (role: Role) => byRole.find((row) => row.role === role)?._count._all ?? 0;
  return {
    total: byRole.reduce((sum, row) => sum + row._count._all, 0),
    learners: countFor("LEARNER"),
    mentors: countFor("MENTOR"),
    admins: countFor("ADMIN"),
  };
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  /** User.lastActiveAt — written by markLessonComplete only (docs/CONTRACTS.md),
   * so it is "last completed a lesson", null for mentors/admins and idle learners. */
  lastActiveAt: Date | null;
  /** A learner's newest enrollment, or the batches a mentor is assigned to
   * (first one named, the rest counted). null when there is neither. */
  placement: { programName: string; batchName: string | null; more: number } | null;
};

export async function getUsersForAdmin(filter: { role?: Role | "all"; search?: string } = {}): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    where: {
      role: filter.role && filter.role !== "all" ? filter.role : undefined,
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        select: { program: { select: { name: true } }, batch: { select: { name: true } } },
      },
      mentorAssignments: {
        orderBy: { batch: { startDate: "desc" } },
        select: { batch: { select: { name: true, program: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((user) => {
    const enrollment = user.enrollments[0];
    const assignment = user.mentorAssignments[0];
    const placement = enrollment
      ? {
          programName: enrollment.program.name,
          batchName: enrollment.batch?.name ?? null,
          more: user.enrollments.length - 1,
        }
      : assignment
        ? {
            programName: assignment.batch.program.name,
            batchName: assignment.batch.name,
            more: user.mentorAssignments.length - 1,
          }
        : null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      placement,
    };
  });
}

export type AdminUserDetail = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  enrollments: {
    id: string;
    programName: string;
    batchName: string | null;
    status: EnrollmentStatus;
    accessState: AccessState;
    progressPercent: number;
  }[];
  mentorAssignments: { id: string; batchId: string; batchName: string; batchCode: string; roleLabel: string | null }[];
};

/** mentorAssignments is populated regardless of role (empty array for a
 * non-mentor) — the PAGE decides whether to render the batch-assignment
 * section, same "page decides what to show" posture as M5b's draft
 * redaction; this query never branches on role itself. */
export async function getUserDetailForAdmin(userId: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      enrollments: {
        select: {
          id: true,
          status: true,
          accessState: true,
          progressPercent: true,
          program: { select: { name: true } },
          batch: { select: { name: true } },
        },
      },
      mentorAssignments: {
        select: { id: true, batchId: true, roleLabel: true, batch: { select: { name: true, code: true } } },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    enrollments: user.enrollments.map((enrollment) => ({
      id: enrollment.id,
      programName: enrollment.program.name,
      batchName: enrollment.batch?.name ?? null,
      status: enrollment.status,
      accessState: enrollment.accessState,
      progressPercent: enrollment.progressPercent,
    })),
    mentorAssignments: user.mentorAssignments.map((assignment) => ({
      id: assignment.id,
      batchId: assignment.batchId,
      batchName: assignment.batch.name,
      batchCode: assignment.batch.code,
      roleLabel: assignment.roleLabel,
    })),
  };
}

export type AdminBatchOption = { id: string; code: string; name: string; programName: string };

/** Batch options for the "assign mentor" dropdown — every batch, not scoped
 * to anything (this is an admin-only surface). */
export async function getAllBatchesForAdmin(): Promise<AdminBatchOption[]> {
  const batches = await prisma.batch.findMany({
    select: { id: true, code: true, name: true, program: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  return batches.map((batch) => ({ id: batch.id, code: batch.code, name: batch.name, programName: batch.program.name }));
}

export type AdminCertificateRow = {
  id: string;
  certificateNumber: string;
  learnerName: string;
  learnerEmail: string;
  programName: string;
  batchName: string | null;
  issuedAt: Date;
  status: CertificateStatus;
};

export type CertificateOverview = {
  /** Every certificate ever issued, valid or revoked. */
  issued: number;
  revoked: number;
  /** Distinct Certificate.templateName values in use (there is no template model — DECISIONS.md #20). */
  templates: number;
  /** Enrollments at exactly 100% with NO certificate of any status — what an
   * admin can issue by hand. Normally empty: completion issues automatically;
   * a curriculum edit that lifts someone to 100% does not (progress-rollup.ts). */
  eligible: { enrollmentId: string; userId: string; learnerName: string; learnerEmail: string; programName: string; batchName: string | null }[];
};

export async function getCertificateOverview(): Promise<CertificateOverview> {
  const [issued, revoked, templates, eligible] = await Promise.all([
    prisma.certificate.count(),
    prisma.certificate.count({ where: { status: "REVOKED" } }),
    prisma.certificate.findMany({ distinct: ["templateName"], select: { templateName: true } }),
    prisma.enrollment.findMany({
      where: { progressPercent: 100, status: { notIn: ["CANCELLED", "DROPPED"] }, certificates: { none: {} } },
      orderBy: { enrolledAt: "asc" },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true } },
        program: { select: { name: true } },
        batch: { select: { name: true } },
      },
    }),
  ]);
  return {
    issued,
    revoked,
    templates: templates.length,
    eligible: eligible.map((enrollment) => ({
      enrollmentId: enrollment.id,
      userId: enrollment.user.id,
      learnerName: enrollment.user.name,
      learnerEmail: enrollment.user.email,
      programName: enrollment.program.name,
      batchName: enrollment.batch?.name ?? null,
    })),
  };
}

export async function getCertificatesForAdmin(
  filter: { status?: CertificateStatus | "all"; search?: string; programId?: string } = {},
): Promise<AdminCertificateRow[]> {
  const certificates = await prisma.certificate.findMany({
    where: {
      status: filter.status && filter.status !== "all" ? filter.status : undefined,
      programId: filter.programId || undefined,
      ...(filter.search
        ? {
            OR: [
              { certificateNumber: { contains: filter.search, mode: "insensitive" } },
              { user: { name: { contains: filter.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      certificateNumber: true,
      issuedAt: true,
      status: true,
      user: { select: { name: true, email: true } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return certificates.map((certificate) => ({
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    learnerName: certificate.user.name,
    learnerEmail: certificate.user.email,
    programName: certificate.program.name,
    batchName: certificate.batch?.name ?? null,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
  }));
}

export type AdminCertificateDetail = {
  id: string;
  certificateNumber: string;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  programName: string;
  batchName: string | null;
  templateName: string;
  issuedAt: Date;
  status: CertificateStatus;
  revokedAt: Date | null;
  revokedReason: string | null;
};

export async function getCertificateDetailForAdmin(id: string): Promise<AdminCertificateDetail | null> {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    select: {
      id: true,
      certificateNumber: true,
      issuedAt: true,
      status: true,
      revokedAt: true,
      revokedReason: true,
      templateName: true,
      user: { select: { id: true, name: true, email: true } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
    },
  });
  if (!certificate) return null;

  return {
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    userId: certificate.user.id,
    learnerName: certificate.user.name,
    learnerEmail: certificate.user.email,
    programName: certificate.program.name,
    batchName: certificate.batch?.name ?? null,
    templateName: certificate.templateName,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    revokedAt: certificate.revokedAt,
    revokedReason: certificate.revokedReason,
  };
}

export type AdminProgramCounts = { total: number; published: number; draft: number; archived: number };

export type AdminProgramRow = {
  id: string;
  name: string;
  description: string;
  status: ContentStatus;
  moduleCount: number;
  activeBatchCount: number;
  enrollmentCount: number;
  updatedAt: Date;
};

/** /admin/programs. `counts` are platform-wide (the stat cards don't follow
 * the tab/search filter); `rows` do. Sorted by most recently updated. */
export async function getProgramsForAdmin(
  filter: { status?: ContentStatus | "all"; search?: string } = {},
): Promise<{ counts: AdminProgramCounts; rows: AdminProgramRow[] }> {
  const [grouped, programs] = await Promise.all([
    prisma.program.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.program.findMany({
      where: {
        status: filter.status && filter.status !== "all" ? filter.status : undefined,
        ...(filter.search
          ? {
              OR: [
                { name: { contains: filter.search, mode: "insensitive" } },
                { description: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        updatedAt: true,
        batches: { where: { status: "ACTIVE" }, select: { id: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
    }),
  ]);

  const countFor = (status: ContentStatus) => grouped.find((row) => row.status === status)?._count._all ?? 0;
  const counts: AdminProgramCounts = {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    published: countFor("PUBLISHED"),
    draft: countFor("DRAFT"),
    archived: countFor("ARCHIVED"),
  };

  return {
    counts,
    rows: programs.map((program) => ({
      id: program.id,
      name: program.name,
      description: program.description,
      status: program.status,
      moduleCount: program._count.modules,
      activeBatchCount: program.batches.length,
      enrollmentCount: program._count.enrollments,
      updatedAt: program.updatedAt,
    })),
  };
}

export type AdminProgramDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: ContentStatus;
  level: ProgramLevel;
  durationWeeks: number;
  format: ProgramFormat;
  credentialType: string | null;
  /** Program.price as a number; null when unset. No currency is stored. */
  price: number | null;
  /** The public page's "What you'll learn" tiles, in order. */
  outcomes: { id: string; title: string; description: string }[];
  /** Codes of the ACTIVE batches, by start date. */
  activeBatchCodes: string[];
  /** UPCOMING + ACTIVE — the batches archiving the program would also archive. */
  openBatchCount: number;
  /** Every enrollment row, whatever its status. */
  enrollmentCount: number;
  activeEnrollmentCount: number;
  completedEnrollmentCount: number;
  /** Distinct mentors across the program's batches (DECISIONS.md #7). */
  mentorCount: number;
  curriculum: {
    moduleCount: number;
    lessonCount: number;
    /** PRACTICE assessments + assignments — what the learner practice hub lists. */
    practiceActivityCount: number;
    gradedAssessmentCount: number;
  };
  modules: { id: string; order: number; title: string; status: ContentStatus; lessonCount: number }[];
  /** Newest start date first, at most RECENT_BATCH_LIMIT. */
  recentBatches: {
    id: string;
    name: string;
    code: string;
    status: BatchStatus;
    startDate: Date;
    capacity: number | null;
    learnerCount: number;
  }[];
};

const RECENT_BATCH_LIMIT = 4;

export async function getProgramDetailForAdmin(id: string): Promise<AdminProgramDetail | null> {
  const program = await prisma.program.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      level: true,
      durationWeeks: true,
      format: true,
      credentialType: true,
      price: true,
      outcomes: { orderBy: { order: "asc" }, select: { id: true, title: true, description: true } },
      modules: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          status: true,
          assessments: { select: { kind: true } },
          _count: { select: { lessons: true, assignments: true } },
        },
      },
      batches: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          startDate: true,
          capacity: true,
          mentors: { select: { mentorId: true } },
          _count: { select: { enrollments: true } },
        },
      },
      enrollments: { select: { status: true } },
    },
  });
  if (!program) return null;

  const assessments = program.modules.flatMap((programModule) => programModule.assessments);
  const assignmentCount = program.modules.reduce((sum, programModule) => sum + programModule._count.assignments, 0);
  const mentorIds = new Set(program.batches.flatMap((batch) => batch.mentors.map((mentor) => mentor.mentorId)));

  return {
    id: program.id,
    name: program.name,
    slug: program.slug,
    description: program.description,
    status: program.status,
    level: program.level,
    durationWeeks: program.durationWeeks,
    format: program.format,
    credentialType: program.credentialType,
    price: program.price === null ? null : Number(program.price),
    outcomes: program.outcomes,
    activeBatchCodes: program.batches
      .filter((batch) => batch.status === "ACTIVE")
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((batch) => batch.code),
    openBatchCount: program.batches.filter((batch) => batch.status === "UPCOMING" || batch.status === "ACTIVE").length,
    enrollmentCount: program.enrollments.length,
    activeEnrollmentCount: program.enrollments.filter((enrollment) => enrollment.status === "ACTIVE").length,
    completedEnrollmentCount: program.enrollments.filter((enrollment) => enrollment.status === "COMPLETED").length,
    mentorCount: mentorIds.size,
    curriculum: {
      moduleCount: program.modules.length,
      lessonCount: program.modules.reduce((sum, programModule) => sum + programModule._count.lessons, 0),
      practiceActivityCount: assessments.filter((assessment) => assessment.kind === "PRACTICE").length + assignmentCount,
      gradedAssessmentCount: assessments.filter((assessment) => assessment.kind === "GRADED").length,
    },
    modules: program.modules.map((programModule) => ({
      id: programModule.id,
      order: programModule.order,
      title: programModule.title,
      status: programModule.status,
      lessonCount: programModule._count.lessons,
    })),
    recentBatches: program.batches.slice(0, RECENT_BATCH_LIMIT).map((batch) => ({
      id: batch.id,
      name: batch.name,
      code: batch.code,
      status: batch.status,
      startDate: batch.startDate,
      capacity: batch.capacity,
      learnerCount: batch._count.enrollments,
    })),
  };
}