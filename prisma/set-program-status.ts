// Sets a Program's status — the one curriculum-lifecycle write the app has
// no admin UI for (docs/CONTRACTS.md, Known gaps). Like bootstrap.ts, this
// is MEANT to run against Neon, so it deliberately has NO local-DB guard.
//
// Usage: npx tsx prisma/set-program-status.ts <slug> <DRAFT|PUBLISHED|ARCHIVED> [--apply]
//
// Without --apply it is a dry run: prints the program, its batches, the
// enrollment count and exactly what would change, then exits without
// writing. With --apply it performs, in ONE transaction:
//   - Program.status = <status>
//   - when <status> is ARCHIVED: every UPCOMING/ACTIVE batch of the program
//     also becomes ARCHIVED (nothing else can be joined once the program is
//     hidden, and an archived program shouldn't advertise open cohorts).
// It never deletes anything, and never touches Enrollment — a GRANTED
// learner of an archived program keeps their content (see
// scripts/verify-enroll.ts). Un-archiving does NOT restore batches; re-open
// those explicitly if you ever need to.
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const statusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const REOPENABLE_BATCH_STATUSES = ["UPCOMING", "ACTIVE"] as const;

function usage(): never {
  console.error("Usage: npx tsx prisma/set-program-status.ts <slug> <DRAFT|PUBLISHED|ARCHIVED> [--apply]");
  process.exit(1);
}

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const positional = args.filter((arg) => arg !== "--apply");
  if (positional.length !== 2) usage();
  const [slug, rawStatus] = positional;
  const parsedStatus = statusSchema.safeParse(rawStatus);
  if (!parsedStatus.success) usage();
  const target = parsedStatus.data;

  console.log(`Database host: ${dbHost()}`);
  console.log(`Mode:          ${apply ? "APPLY (will write)" : "DRY RUN (no writes)"}\n`);

  const program = await prisma.program.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      batches: {
        orderBy: { startDate: "asc" },
        select: { id: true, code: true, name: true, status: true, startDate: true, endDate: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!program) {
    console.error(`No program with slug "${slug}". Nothing was written.`);
    process.exit(1);
  }

  console.log(`Program:     ${program.name} (slug=${program.slug})`);
  console.log(`Status:      ${program.status}`);
  console.log(`Enrollments: ${program._count.enrollments}`);
  console.log(`Batches:     ${program.batches.length}`);
  for (const batch of program.batches) {
    console.log(
      `  ${batch.code} — ${batch.name} [${batch.status}] ` +
        `${batch.startDate.toISOString().slice(0, 10)} → ${batch.endDate.toISOString().slice(0, 10)}`,
    );
  }

  const batchesToArchive =
    target === "ARCHIVED"
      ? program.batches.filter((batch) => (REOPENABLE_BATCH_STATUSES as readonly string[]).includes(batch.status))
      : [];
  const programChanges = program.status !== target;

  console.log("\nChanges:");
  if (programChanges) {
    console.log(`  Program.status: ${program.status} → ${target}`);
  } else {
    console.log(`  Program.status: already ${target} (no change)`);
  }
  for (const batch of batchesToArchive) {
    console.log(`  Batch ${batch.code}.status: ${batch.status} → ARCHIVED`);
  }
  if (target === "ARCHIVED" && batchesToArchive.length === 0) {
    console.log("  Batches: none are UPCOMING/ACTIVE, nothing to archive");
  }
  console.log(
    `  Enrollments: untouched (${program._count.enrollments} row(s); GRANTED learners keep their content)`,
  );

  if (!programChanges && batchesToArchive.length === 0) {
    console.log("\nNothing to do. Nothing was written.");
    return;
  }

  if (!apply) {
    console.log("\nDry run — nothing was written. Re-run with --apply to make these changes.");
    return;
  }

  const [updatedProgram, archivedBatches] = await prisma.$transaction([
    prisma.program.update({ where: { id: program.id }, data: { status: target }, select: { status: true } }),
    prisma.batch.updateMany({
      where: { id: { in: batchesToArchive.map((batch) => batch.id) } },
      data: { status: "ARCHIVED" },
    }),
  ]);

  console.log("\nApplied:");
  console.log(`  Program.status is now ${updatedProgram.status}`);
  console.log(`  Batches archived: ${archivedBatches.count}`);
  console.log("  Nothing was deleted.");
}

main()
  .catch((error: unknown) => {
    console.error("set-program-status failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
