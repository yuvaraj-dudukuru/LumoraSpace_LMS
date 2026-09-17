// For a database that already has User rows (real signups happened before
// curriculum was loaded) — bootstrap.ts's all-or-nothing guard (refuse if
// any User exists) can't run here, and re-running it isn't the right tool
// anyway since it always also creates a brand-new admin account in the same
// transaction.
//
// This script does exactly one thing: load every program in
// prisma/bootstrap-data.json (Program -> Module -> Lesson -> Assessment/
// Question -> Assignment/RubricCriterion -> Batch) via the exact same
// createCurriculum() used by bootstrap.ts (see bootstrap-schema.ts) — so the
// two scripts can never disagree on what "curriculum" means. It never
// touches User, never touches an existing Program, and never deletes
// anything.
//
// Guard: per program SLUG. If any slug in the file already exists in the
// database, the whole run is refused before any write — there is no admin
// curriculum editor in this app (docs/CONTRACTS.md, Known gaps), so the only
// ways to change existing curriculum are a new slug in this file or a direct
// database change.
//
// Run: npx tsx prisma/bootstrap-curriculum.ts
// No env vars required — this doesn't create an admin account. Promote an
// existing account to ADMIN in the database, or have an existing admin create
// one at /admin/users.
import { PrismaClient } from "@prisma/client";
import {
  BOOTSTRAP_TRANSACTION_TIMEOUT_MS,
  TEMPLATE_REFUSAL_MESSAGE,
  createCurriculum,
  isTemplateData,
  loadBootstrapData,
  loginUrlHint,
  printCurriculumSummary,
} from "./bootstrap-schema";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Validated (shape + every cross-reference rule) before any DB call.
  const data = loadBootstrapData();
  if (isTemplateData(data)) {
    console.error(TEMPLATE_REFUSAL_MESSAGE);
    process.exit(1);
  }

  const slugs = data.programs.map((programDef) => programDef.program.slug);
  const existing = await prisma.program.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  if (existing.length > 0) {
    console.error(
      `Refused: ${existing.length} program slug(s) in prisma/bootstrap-data.json already exist in the ` +
        `database: ${existing.map((p) => `"${p.slug}"`).join(", ")}. ` +
        "This script only creates programs that don't exist yet, and never modifies an existing one. " +
        "There is no admin curriculum editor in this app — to add content, give the new program a " +
        "different slug in bootstrap-data.json; to change an existing program, edit the database " +
        "directly. Nothing was written.",
    );
    process.exit(1);
  }

  const summaries = await prisma.$transaction(
    async (tx) => {
      const results = [];
      for (const programDef of data.programs) {
        results.push(await createCurriculum(tx, programDef));
      }
      return results;
    },
    { timeout: BOOTSTRAP_TRANSACTION_TIMEOUT_MS },
  );

  console.log("Curriculum load complete:");
  for (const summary of summaries) {
    console.log("");
    printCurriculumSummary(summary);
  }
  console.log(
    "\nNo User row was created, changed, or deleted. This script refuses to run again for any program slug that already exists.",
  );
  console.log(`Sign in at ${loginUrlHint()}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Curriculum load failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
