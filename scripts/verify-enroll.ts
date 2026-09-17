// Exercises the enroll rule (findOpenBatchForEnrollment, queries/programs.ts)
// and the "an archived program is invisible in the catalog but its GRANTED
// learners keep their content" posture against the real local seeded DB.
// Temporarily flips Forge Data Analyst / FDA-B04 statuses and restores them
// in `finally` — the only writes in this file, and assertLocalDatabase()
// guarantees they can only ever hit localhost.
//
// queries/*.ts import "server-only", which throws outside Next's bundler
// unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-enroll.ts
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase } from "./assert-local-db";
import {
  findOpenBatchForEnrollment,
  getPublishedPrograms,
  getProgramForCatalog,
  getEnrollableBatches,
} from "../src/lib/queries/programs";
import { resolveLessonProgram } from "../src/lib/queries/lessons";
import { getProgramProgress } from "../src/lib/queries/progress";

// First, before the client exists — never against a non-local DB.
assertLocalDatabase();

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [fda, fullStack, fdaB04, alex] = await Promise.all([
    prisma.program.findUniqueOrThrow({ where: { slug: "forge-data-analyst" } }),
    prisma.program.findUniqueOrThrow({ where: { slug: "forge-full-stack-developer" } }),
    prisma.batch.findUniqueOrThrow({ where: { code: "FDA-B04" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } }),
  ]);
  if (fda.status !== "PUBLISHED" || (fdaB04.status !== "ACTIVE" && fdaB04.status !== "UPCOMING")) {
    throw new Error(
      `Fixture assumption broken: forge-data-analyst=${fda.status}, FDA-B04=${fdaB04.status} — reseed the local DB.`,
    );
  }
  const alexEnrollment = await prisma.enrollment.findFirstOrThrow({
    where: { userId: alex.id, programId: fda.id },
    select: { id: true, accessState: true },
  });
  const firstLesson = await prisma.lesson.findFirstOrThrow({
    where: { module: { programId: fda.id } },
    orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
    select: { id: true },
  });

  // 1. Happy path: PUBLISHED program + ACTIVE batch that belongs to it.
  const open = await findOpenBatchForEnrollment(fda.id, fdaB04.id);
  record("PUBLISHED program + ACTIVE batch (FDA-B04) is open for enrollment", open !== null, `capacity=${open?.capacity}`);

  // 2. A batch id from a DIFFERENT program is rejected.
  const mismatched = await findOpenBatchForEnrollment(fullStack.id, fdaB04.id);
  record("A batch that doesn't belong to the program (FDA-B04 x Full Stack) is rejected", mismatched === null);

  // 3. Batch not UPCOMING/ACTIVE is rejected — flip FDA-B04 to COMPLETED, restore.
  let closedBatchResult: unknown = "not-run";
  try {
    await prisma.batch.update({ where: { id: fdaB04.id }, data: { status: "COMPLETED" } });
    closedBatchResult = await findOpenBatchForEnrollment(fda.id, fdaB04.id);
  } finally {
    await prisma.batch.update({ where: { id: fdaB04.id }, data: { status: fdaB04.status } });
  }
  record("A COMPLETED batch is rejected even on a PUBLISHED program", closedBatchResult === null);

  // 4–8. Program ARCHIVED (batch still ACTIVE): can't be joined, invisible in
  // the catalog, but the existing GRANTED learner's content still resolves.
  let archivedEnroll: unknown = "not-run";
  let archivedInCatalogList: boolean | null = null;
  let archivedDetail: unknown = "not-run";
  let archivedEnrollableBatches: number | null = null;
  let archivedLessonResolves: boolean | null = null;
  let archivedProgressLessons: number | null = null;
  try {
    await prisma.program.update({ where: { id: fda.id }, data: { status: "ARCHIVED" } });
    archivedEnroll = await findOpenBatchForEnrollment(fda.id, fdaB04.id);
    archivedInCatalogList = (await getPublishedPrograms()).some((p) => p.id === fda.id);
    archivedDetail = await getProgramForCatalog(fda.slug);
    archivedEnrollableBatches = (await getEnrollableBatches(fda.id)).length;
    const resolved = await resolveLessonProgram(firstLesson.id);
    archivedLessonResolves = resolved?.programId === fda.id;
    archivedProgressLessons = (await getProgramProgress(alexEnrollment.id)).totalLessons;
  } finally {
    await prisma.program.update({ where: { id: fda.id }, data: { status: fda.status } });
  }
  record("ARCHIVED program cannot be joined even though its batch is still ACTIVE", archivedEnroll === null);
  record("ARCHIVED program is absent from getPublishedPrograms (/programs)", archivedInCatalogList === false);
  record("ARCHIVED program returns null from getProgramForCatalog (/programs/[slug] -> notFound)", archivedDetail === null);
  record(
    "ARCHIVED program: existing GRANTED learner's lesson still resolves (resolveLessonProgram)",
    archivedLessonResolves === true && alexEnrollment.accessState === "GRANTED",
    `accessState=${alexEnrollment.accessState}`,
  );
  record(
    "ARCHIVED program: existing GRANTED learner's progress still computes (getProgramProgress)",
    archivedProgressLessons !== null && archivedProgressLessons > 0,
    `totalLessons=${archivedProgressLessons}`,
  );
  record(
    "(info) getEnrollableBatches doesn't filter on program status — the detail page never reaches it for a non-PUBLISHED program",
    archivedEnrollableBatches !== null && archivedEnrollableBatches > 0,
    `batches=${archivedEnrollableBatches} — enrollAction is guarded by findOpenBatchForEnrollment regardless`,
  );

  // 9. Restoration sanity.
  const [fdaAfter, b04After] = await Promise.all([
    prisma.program.findUniqueOrThrow({ where: { id: fda.id }, select: { status: true } }),
    prisma.batch.findUniqueOrThrow({ where: { id: fdaB04.id }, select: { status: true } }),
  ]);
  record(
    "Fixture statuses restored afterwards",
    fdaAfter.status === fda.status && b04After.status === fdaB04.status,
    `program=${fdaAfter.status} batch=${b04After.status}`,
  );

  console.log("verify-enroll results:\n");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }
  const failures = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
