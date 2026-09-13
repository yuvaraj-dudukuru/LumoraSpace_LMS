// Exercises the M5a query layer (src/lib/queries/assignments.ts) and the
// nextAttemptNumber/canSubmitNewAttempt rules against the real seeded DB —
// read-only, mutates nothing. Mirrors scripts/verify-assessments.ts's
// conventions (separate file per domain, same PASS/FAIL harness).
//
// queries/assignments.ts imports "server-only", which throws outside Next's
// bundler unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-assignments.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  getAssignmentDetail,
  getSubmissionWithReview,
  nextAttemptNumber,
  canSubmitNewAttempt,
} from "../src/lib/queries/assignments";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [alex, aisha, david, marcus, priya] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "aisha.patel@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "david.kim@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "marcus.wei@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "priya.sharma@example.com" } }),
  ]);
  const forgeDataAnalyst = await prisma.program.findUniqueOrThrow({ where: { slug: "forge-data-analyst" } });
  const sqlOptAssignment = await prisma.assignment.findFirstOrThrow({ where: { title: "SQL Optimization" } });
  const dataCleaningAssignment = await prisma.assignment.findFirstOrThrow({
    where: { title: "Data Cleaning Assignment" },
  });

  const [alexEnrollment, aishaEnrollment, davidEnrollment, marcusEnrollment, priyaEnrollment] = await Promise.all([
    prisma.enrollment.findFirstOrThrow({ where: { userId: alex.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: aisha.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: david.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: marcus.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: priya.id, programId: forgeDataAnalyst.id } }),
  ]);

  // 1. Every seeded Submission resolves to the same program as its enrollment.
  const allSubmissions = await prisma.submission.findMany({
    select: {
      id: true,
      assignment: { select: { title: true, module: { select: { programId: true } } } },
      enrollment: { select: { programId: true } },
    },
  });
  const mismatched = allSubmissions.filter((s) => s.assignment.module.programId !== s.enrollment.programId);
  record(
    "Every seeded Submission's assignment program matches its enrollment's program",
    allSubmissions.length > 0 && mismatched.length === 0,
    `total=${allSubmissions.length} mismatched=${mismatched.map((s) => s.id).join(",")}`,
  );

  // 2. Every REVIEWED submission's rubricScores reference criteria belonging
  // to that same assignment.
  const reviewedSubmissions = await prisma.submission.findMany({
    where: { status: "REVIEWED" },
    select: {
      id: true,
      assignmentId: true,
      review: { select: { rubricScores: { select: { criterion: { select: { assignmentId: true } } } } } },
    },
  });
  const badRubricLinks = reviewedSubmissions.filter((s) =>
    s.review?.rubricScores.some((rs) => rs.criterion.assignmentId !== s.assignmentId),
  );
  record(
    "Every REVIEWED submission's rubricScores reference criteria from the same assignment",
    reviewedSubmissions.length > 0 && badRubricLinks.length === 0,
    `reviewed=${reviewedSubmissions.length} bad=${badRubricLinks.map((s) => s.id).join(",")}`,
  );

  // 3. getSubmissionWithReview: correct ownership + no cross-learner leakage.
  const alexSubmission = await prisma.submission.findFirstOrThrow({
    where: { assignmentId: sqlOptAssignment.id, enrollmentId: alexEnrollment.id },
  });
  const withReview = await getSubmissionWithReview(alexSubmission.id);
  record(
    "getSubmissionWithReview: userId matches Alex (ownership check would pass)",
    withReview?.userId === alex.id,
    `userId=${withReview?.userId}`,
  );
  record(
    "getSubmissionWithReview: userId does NOT match a different learner (David)",
    withReview?.userId !== david.id,
  );
  record(
    "getSubmissionWithReview: REVIEWED submission exposes score/rubric/mentor name",
    withReview?.review?.score === 83 &&
      withReview.review.mentorName.length > 0 &&
      withReview.review.rubricScores.length === 4,
    JSON.stringify(withReview?.review),
  );

  // 4. getAssignmentDetail excludes NOT_STARTED rows — Priya's Data Cleaning
  // Assignment submission history should read as empty, same as no row at all.
  const priyaDetail = await getAssignmentDetail(dataCleaningAssignment.id, priyaEnrollment.id);
  record(
    "getAssignmentDetail excludes a NOT_STARTED row from submission history",
    priyaDetail?.submissions.length === 0,
    `submissions=${JSON.stringify(priyaDetail?.submissions)}`,
  );

  // 5. canSubmitNewAttempt / nextAttemptNumber against real fixture states.
  const aishaDetail = await getAssignmentDetail(sqlOptAssignment.id, aishaEnrollment.id);
  const davidDetail = await getAssignmentDetail(sqlOptAssignment.id, davidEnrollment.id);
  const alexDetail = await getAssignmentDetail(sqlOptAssignment.id, alexEnrollment.id);
  const marcusDetail = await getAssignmentDetail(dataCleaningAssignment.id, marcusEnrollment.id);

  record(
    "Aisha (UNDER_REVIEW) cannot submit a new attempt",
    aishaDetail !== null && canSubmitNewAttempt(aishaDetail.submissions, aishaDetail.maxAttempts) === false,
  );
  record(
    "David (SUBMITTED) cannot submit a new attempt",
    davidDetail !== null && canSubmitNewAttempt(davidDetail.submissions, davidDetail.maxAttempts) === false,
  );
  record(
    "Alex (REVIEWED, 1/2 used) CAN submit a new attempt, next attemptNumber is 2",
    alexDetail !== null &&
      canSubmitNewAttempt(alexDetail.submissions, alexDetail.maxAttempts) === true &&
      nextAttemptNumber(alexDetail.submissions) === 2,
  );
  record(
    "Marcus (REVISION_REQUESTED, maxAttempts:1 already used) CAN still submit — bypasses the cap",
    marcusDetail !== null &&
      marcusDetail.maxAttempts === 1 &&
      canSubmitNewAttempt(marcusDetail.submissions, marcusDetail.maxAttempts) === true,
    `maxAttempts=${marcusDetail?.maxAttempts} submissions=${JSON.stringify(marcusDetail?.submissions.map((s) => s.status))}`,
  );
  record(
    "Priya (NOT_STARTED only, filtered to empty) CAN submit, next attemptNumber is 1",
    priyaDetail !== null &&
      canSubmitNewAttempt(priyaDetail.submissions, priyaDetail.maxAttempts) === true &&
      nextAttemptNumber(priyaDetail.submissions) === 1,
  );

  // 12. Static check on the actual deployed source (not a DB write — Priya's
  // NOT_STARTED fixture is left untouched for manual testing): submitAssignment
  // must write via upsert on the exact compound unique key, never a plain
  // create, or attemptNumber 1 would collide with her existing placeholder row.
  const actionsSource = readFileSync(
    join(process.cwd(), "src/app/learn/assignments/[assignmentId]/actions.ts"),
    "utf-8",
  );
  const usesUpsertOnCompoundKey =
    /prisma\.submission\.upsert\(/.test(actionsSource) &&
    /assignmentId_enrollmentId_attemptNumber/.test(actionsSource);
  const usesPlainSubmissionCreate = /prisma\.submission\.create\(/.test(actionsSource);
  record(
    "submitAssignment writes via upsert on the compound unique key, not a plain create",
    usesUpsertOnCompoundKey && !usesPlainSubmissionCreate,
    `upsert=${usesUpsertOnCompoundKey} plainCreate=${usesPlainSubmissionCreate}`,
  );

  console.log("verify-assignments results:\n");
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
