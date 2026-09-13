import "server-only";
import type { AccessState, EnrollmentStatus, Role, UserStatus, CertificateStatus } from "@prisma/client";
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

export type AdminEnrollmentRow = {
  id: string;
  learnerName: string;
  learnerEmail: string;
  programName: string;
  batchName: string | null;
  status: EnrollmentStatus;
  accessState: AccessState;
  progressPercent: number;
  enrolledAt: Date;
};

export type EnrollmentFilter = {
  accessState?: AccessState | "all";
  status?: EnrollmentStatus | "all";
  search?: string;
};

/** Default view (no filter args) sorts AWAITING first — that's the queue an
 * admin actually works day to day. `orderBy` can't express "this enum value
 * first" directly, so the AWAITING-first ordering is applied in JS after the
 * DB query, not via Prisma's orderBy. */
export async function getEnrollmentsForAdmin(filter: EnrollmentFilter = {}): Promise<AdminEnrollmentRow[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      accessState: filter.accessState && filter.accessState !== "all" ? filter.accessState : undefined,
      status: filter.status && filter.status !== "all" ? filter.status : undefined,
      ...(filter.search
        ? {
            user: {
              OR: [
                { name: { contains: filter.search, mode: "insensitive" } },
                { email: { contains: filter.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      accessState: true,
      progressPercent: true,
      enrolledAt: true,
      user: { select: { name: true, email: true } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const rows: AdminEnrollmentRow[] = enrollments.map((enrollment) => ({
    id: enrollment.id,
    learnerName: enrollment.user.name,
    learnerEmail: enrollment.user.email,
    programName: enrollment.program.name,
    batchName: enrollment.batch?.name ?? null,
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

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

export async function getUsersForAdmin(filter: { role?: Role | "all"; search?: string } = {}): Promise<AdminUserRow[]> {
  return prisma.user.findMany({
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
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
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
  programName: string;
  issuedAt: Date;
  status: CertificateStatus;
};

export async function getCertificatesForAdmin(
  filter: { status?: CertificateStatus | "all"; search?: string } = {},
): Promise<AdminCertificateRow[]> {
  const certificates = await prisma.certificate.findMany({
    where: {
      status: filter.status && filter.status !== "all" ? filter.status : undefined,
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
      user: { select: { name: true } },
      program: { select: { name: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return certificates.map((certificate) => ({
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    learnerName: certificate.user.name,
    programName: certificate.program.name,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
  }));
}

export type AdminCertificateDetail = {
  id: string;
  certificateNumber: string;
  learnerName: string;
  learnerEmail: string;
  programName: string;
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
      user: { select: { name: true, email: true } },
      program: { select: { name: true } },
    },
  });
  if (!certificate) return null;

  return {
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    learnerName: certificate.user.name,
    learnerEmail: certificate.user.email,
    programName: certificate.program.name,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    revokedAt: certificate.revokedAt,
    revokedReason: certificate.revokedReason,
  };
}
