// Exercises the M5b batch-scoping rules and rubric validation against the
// real seeded DB — read-only, mutates nothing. Mirrors the existing per-
// domain verify-*.ts convention.
//
// queries/mentor.ts imports "server-only", which throws outside Next's
// bundler unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-mentor.ts
import { PrismaClient } from "@prisma/client";
import { getMentorBatchIds, getLearnerDetail, getReviewQueue } from "../src/lib/queries/mentor";
import { validateRubricScoreEntries, validateRubricScoresComplete } from "../src/lib/validations/review";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [michael, sarah, admin, weiZhang] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "michael.chen@lumoraspace.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "sarah.jenkins@lumoraspace.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "admin@lumoraspace.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "wei.zhang@example.com" } }),
  ]);
  const [fdaBatch04, fsdBatch03] = await Promise.all([
    prisma.batch.findUniqueOrThrow({ where: { code: "FDA-B04" } }),
    prisma.batch.findUniqueOrThrow({ where: { code: "FSD-B03" } }),
  ]);
  const allBatches = await prisma.batch.findMany({ select: { id: true } });

  // 1. A mentor's batch ids exclude a batch with no MentorAssignment for them.
  const michaelBatchIds = await getMentorBatchIds(michael);
  record(
    "Michael Chen's batch ids include FDA-B04 but exclude FSD-B03 (no MentorAssignment there)",
    michaelBatchIds.includes(fdaBatch04.id) && !michaelBatchIds.includes(fsdBatch03.id),
    `batchIds=${JSON.stringify(michaelBatchIds)}`,
  );
  const sarahBatchIds = await getMentorBatchIds(sarah);
  record(
    "Sarah Jenkins's batch ids include BOTH FDA-B04 and FSD-B03",
    sarahBatchIds.includes(fdaBatch04.id) && sarahBatchIds.includes(fsdBatch03.id),
    `batchIds=${JSON.stringify(sarahBatchIds)}`,
  );

  // 2. An admin sees every batch.
  const adminBatchIds = await getMentorBatchIds(admin);
  record(
    "Admin's batch ids include every batch in the system",
    adminBatchIds.length === allBatches.length && allBatches.every((b) => adminBatchIds.includes(b.id)),
    `admin=${adminBatchIds.length} total=${allBatches.length}`,
  );

  // 3. getLearnerDetail returns null for a learner outside the caller's batches.
  const weiForMichael = await getLearnerDetail(weiZhang.id, michaelBatchIds);
  record(
    "getLearnerDetail(Wei Zhang, Michael's batchIds) is null — Wei is Full-Stack/FSD-B03 only",
    weiForMichael === null,
  );
  const weiForSarah = await getLearnerDetail(weiZhang.id, sarahBatchIds);
  record(
    "getLearnerDetail(Wei Zhang, Sarah's batchIds) is NOT null — Sarah has FSD-B03",
    weiForSarah !== null,
  );

  // 4. getReviewQueue only returns submissions from accessible batches — proven
  // by scoping to a batch with zero assignments (FSD-B03, Forge Full Stack has
  // none seeded) and confirming none of FDA's real submissions leak in.
  const fsdOnlyQueue = await getReviewQueue([fsdBatch03.id], "all");
  record(
    "getReviewQueue scoped to FSD-B03 only returns zero submissions (all seeded submissions are FDA-scoped)",
    fsdOnlyQueue.length === 0,
    `count=${fsdOnlyQueue.length}`,
  );
  const fdaQueue = await getReviewQueue([fdaBatch04.id], "all");
  record(
    "getReviewQueue scoped to FDA-B04 returns real submissions (sanity check the scoping isn't just always-empty)",
    fdaQueue.length > 0,
    `count=${fdaQueue.length}`,
  );

  // 5. Rubric validation rejects a foreign criterionId and an over-maxScore value.
  const sqlOptCriteria = await prisma.rubricCriterion.findMany({
    where: { assignment: { title: "SQL Optimization" } },
    select: { id: true, maxScore: true },
  });
  const dataCleaningCriterion = await prisma.rubricCriterion.findFirstOrThrow({
    where: { assignment: { title: "Data Cleaning Assignment" } },
    select: { id: true },
  });

  const foreignIdResult = validateRubricScoreEntries(
    [{ criterionId: dataCleaningCriterion.id, score: 5 }],
    sqlOptCriteria,
  );
  record(
    "validateRubricScoreEntries rejects a criterionId from a different assignment",
    foreignIdResult.ok === false,
    JSON.stringify(foreignIdResult),
  );

  const overMaxResult = validateRubricScoreEntries(
    [{ criterionId: sqlOptCriteria[0].id, score: sqlOptCriteria[0].maxScore + 1 }],
    sqlOptCriteria,
  );
  record(
    "validateRubricScoreEntries rejects a score above maxScore",
    overMaxResult.ok === false,
    JSON.stringify(overMaxResult),
  );

  const validPartial = validateRubricScoreEntries(
    [{ criterionId: sqlOptCriteria[0].id, score: sqlOptCriteria[0].maxScore }],
    sqlOptCriteria,
  );
  record(
    "validateRubricScoreEntries accepts a valid partial entry (drafts may be incomplete)",
    validPartial.ok === true,
  );

  const incompleteForSubmit = validateRubricScoresComplete(
    [{ criterionId: sqlOptCriteria[0].id, score: 0 }],
    sqlOptCriteria,
  );
  record(
    "validateRubricScoresComplete rejects a partial set (submitReview needs every criterion scored)",
    incompleteForSubmit.ok === false,
  );

  const completeForSubmit = validateRubricScoresComplete(
    sqlOptCriteria.map((c) => ({ criterionId: c.id, score: 0 })),
    sqlOptCriteria,
  );
  record(
    "validateRubricScoresComplete accepts a full, in-bounds set",
    completeForSubmit.ok === true,
  );

  console.log("verify-mentor results:\n");
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
