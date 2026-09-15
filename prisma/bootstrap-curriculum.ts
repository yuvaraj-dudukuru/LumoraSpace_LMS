// For a database that already has User rows (real signups happened before
// curriculum was loaded) but has NO curriculum yet — bootstrap.ts's
// all-or-nothing guard (refuse if any User exists) can't run here, and
// re-running it isn't the right tool anyway since it always also creates a
// brand-new admin account in the same transaction.
//
// This script does exactly one thing: load Program -> Module -> Lesson ->
// Assessment/Question -> Assignment/RubricCriterion -> Batch from the same
// prisma/bootstrap-data.json, via the exact same createCurriculum() used by
// bootstrap.ts (see bootstrap-schema.ts) — so the two scripts can never
// disagree on what "curriculum" means. It never touches User, never
// touches an existing Program, and never deletes anything.
//
// Run: npx tsx prisma/bootstrap-curriculum.ts
// No env vars required — this doesn't create an admin account. Create one
// separately (see DEPLOYMENT.md / ask the person who has DB access to
// promote an existing account via `role: ADMIN`, or create a fresh one).
import { PrismaClient } from "@prisma/client";
import { createCurriculum, loadBootstrapData } from "./bootstrap-schema";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Idempotency guard is on Program, not User — this script's whole point
  // is to run against a DB that already has users. Refusing when a Program
  // already exists prevents ever double-loading the same curriculum.
  const existingProgramCount = await prisma.program.count();
  if (existingProgramCount > 0) {
    console.error(
      `Refused: the Program table already has ${existingProgramCount} row(s). ` +
        "This script only loads curriculum into a database that has none yet. " +
        "Add more programs/modules/lessons through /admin instead of re-running this.",
    );
    process.exit(1);
  }

  const data = loadBootstrapData();

  const summary = await prisma.$transaction((tx) => createCurriculum(tx, data), { timeout: 30_000 });

  console.log("Curriculum load complete:\n");
  console.log(`  Program:        ${summary.programName} (/${summary.programSlug})`);
  console.log(`  Modules:        ${summary.moduleCount}`);
  console.log(`  Lessons:        ${summary.lessonCount}`);
  console.log(`  Assessments:    ${summary.assessmentCount} (${summary.questionCount} questions total)`);
  console.log(`  Assignments:    ${summary.assignmentCount} (${summary.rubricCriterionCount} rubric criteria total)`);
  console.log(`  Batches:        ${summary.batches.map((b) => `${b.code} (${b.name})`).join(", ")}`);
  console.log("\nNo User row was created, changed, or deleted. This script will refuse to run again while any Program row exists.");
}

main()
  .catch((error: unknown) => {
    console.error("Curriculum load failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
