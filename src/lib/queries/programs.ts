import "server-only";
import { Prisma, BatchStatus, ContentStatus, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const publishedProgramSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  level: true,
  durationWeeks: true,
  format: true,
  credentialType: true,
  price: true,
  heroImageUrl: true,
} satisfies Prisma.ProgramSelect;

export type PublishedProgram = Prisma.ProgramGetPayload<{ select: typeof publishedProgramSelect }>;

/** Public catalog grid — no auth, no progress data. */
export async function getPublishedPrograms(): Promise<PublishedProgram[]> {
  return prisma.program.findMany({
    where: { status: ContentStatus.PUBLISHED },
    select: publishedProgramSelect,
    orderBy: { name: "asc" },
  });
}

const programForCatalogInclude = {
  outcomes: { orderBy: { order: "asc" } },
  modules: {
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  },
} satisfies Prisma.ProgramInclude;

export type ProgramForCatalog = Prisma.ProgramGetPayload<{ include: typeof programForCatalogInclude }>;

/** Public program detail page — outcomes + curriculum outline, no progress. */
export async function getProgramForCatalog(slug: string): Promise<ProgramForCatalog | null> {
  return prisma.program.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    include: programForCatalogInclude,
  });
}

export type EnrollableBatch = {
  id: string;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  status: BatchStatus;
  capacity: number | null;
  enrolledCount: number;
};

/** Batches open for enrollment on a program, with a live seat count for the
 * capacity check in enrollAction and for display in the picker. */
export async function getEnrollableBatches(programId: string): Promise<EnrollableBatch[]> {
  const batches = await prisma.batch.findMany({
    where: {
      programId,
      status: { in: [BatchStatus.UPCOMING, BatchStatus.ACTIVE] },
    },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      startDate: true,
      endDate: true,
      status: true,
      capacity: true,
      _count: {
        select: {
          enrollments: { where: { status: { not: EnrollmentStatus.CANCELLED } } },
        },
      },
    },
  });

  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    code: batch.code,
    startDate: batch.startDate,
    endDate: batch.endDate,
    status: batch.status,
    capacity: batch.capacity,
    enrolledCount: batch._count.enrollments,
  }));
}
