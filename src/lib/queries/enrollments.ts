import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const enrollmentWithProgramInclude = {
  program: { select: { id: true, name: true, slug: true, heroImageUrl: true, durationWeeks: true } },
  batch: { select: { id: true, name: true, code: true, startDate: true, endDate: true, status: true } },
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentWithProgram = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentWithProgramInclude;
}>;

/** All of a learner's enrollments, program + batch attached — for
 * /learn/my-learning and /learn/progress. */
export async function getEnrollmentsForUser(userId: string): Promise<EnrollmentWithProgram[]> {
  return prisma.enrollment.findMany({
    where: { userId },
    include: enrollmentWithProgramInclude,
    orderBy: { enrolledAt: "desc" },
  });
}

/** Single enrollment, program + batch attached — used once a guard
 * (requireGrantedEnrollment) has already produced the enrollment id. */
export async function getEnrollmentWithProgram(enrollmentId: string): Promise<EnrollmentWithProgram | null> {
  return prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: enrollmentWithProgramInclude,
  });
}
