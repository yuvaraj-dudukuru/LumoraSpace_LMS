// Prints a compact, copy-pasteable reference of real seeded ids for manual
// browser testing — programs, assessments (with ready /learn/assessments/<id>
// URLs), certificates (with /verify/<number> URLs), one GRANTED + one AWAITING
// learner email, and the shared dev password. Read-only, mutates nothing.
//
// Follows the scripts/verify-*.ts conventions (plain PrismaClient, no
// src/lib/queries/* imports needed here so it runs with a plain `npx tsx`,
// no NODE_OPTIONS required).
//
// Run: npx tsx scripts/print-test-ids.ts
import { PrismaClient } from "@prisma/client";
import { DEV_PASSWORD } from "../prisma/dev-password";
import { assertLocalDatabase } from "./assert-local-db";

assertLocalDatabase();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const programs = await prisma.program.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const assessments = await prisma.assessment.findMany({
    select: {
      id: true,
      title: true,
      kind: true,
      timeLimitMins: true,
      allowedAttempts: true,
      showResultsImmediately: true,
      _count: { select: { questions: true } },
      module: { select: { title: true, program: { select: { name: true } } } },
    },
    orderBy: { title: "asc" },
  });

  const assignments = await prisma.assignment.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      maxAttempts: true,
      allowGithubUrl: true,
      dueAt: true,
      module: { select: { title: true, program: { select: { name: true } } } },
    },
    orderBy: { title: "asc" },
  });

  const submissions = await prisma.submission.findMany({
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      assignment: { select: { title: true } },
      enrollment: { select: { user: { select: { name: true } } } },
    },
    orderBy: [{ assignment: { title: "asc" } }, { attemptNumber: "asc" }],
  });

  const mentors = await prisma.user.findMany({
    where: { role: "MENTOR" },
    select: {
      email: true,
      name: true,
      mentorAssignments: {
        select: { roleLabel: true, batch: { select: { code: true, program: { select: { name: true } } } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const certificates = await prisma.certificate.findMany({
    select: {
      certificateNumber: true,
      status: true,
      user: { select: { name: true } },
      program: { select: { name: true } },
    },
    orderBy: { certificateNumber: "asc" },
  });

  // One GRANTED learner per program — prefer an ACTIVE (still in-progress)
  // enrollment over an already-COMPLETED one, since that's the more useful
  // fixture for testing lesson/quiz flows. + one AWAITING learner overall.
  const grantedPerProgram = await prisma.enrollment.findMany({
    where: { accessState: "GRANTED", status: "ACTIVE" },
    distinct: ["programId"],
    orderBy: { enrolledAt: "asc" },
    select: { program: { select: { name: true } }, user: { select: { email: true } } },
  });
  const awaiting = await prisma.enrollment.findFirst({
    where: { accessState: "AWAITING" },
    select: { program: { select: { name: true } }, user: { select: { email: true } } },
  });

  console.log("=".repeat(70));
  console.log("PROGRAMS");
  console.log("=".repeat(70));
  for (const program of programs) {
    console.log(`${program.name}`);
    console.log(`  id:   ${program.id}`);
    console.log(`  slug: ${program.slug}`);
    console.log(`  URL:  /programs/${program.slug}`);
    console.log();
  }

  console.log("=".repeat(70));
  console.log("ASSESSMENTS");
  console.log("=".repeat(70));
  for (const assessment of assessments) {
    console.log(`${assessment.title}  [${assessment.kind}]`);
    console.log(`  id:                     ${assessment.id}`);
    console.log(`  program / module:       ${assessment.module.program.name} / ${assessment.module.title}`);
    console.log(`  timeLimitMins:          ${assessment.timeLimitMins ?? "none"}`);
    console.log(`  allowedAttempts:        ${assessment.allowedAttempts === 0 ? "unlimited" : assessment.allowedAttempts}`);
    console.log(`  showResultsImmediately: ${assessment.showResultsImmediately}`);
    console.log(`  questions:              ${assessment._count.questions}`);
    console.log(`  URL:                    /learn/assessments/${assessment.id}`);
    console.log();
  }

  console.log("=".repeat(70));
  console.log("ASSIGNMENTS");
  console.log("=".repeat(70));
  for (const assignment of assignments) {
    console.log(`${assignment.title}  [${assignment.type}]`);
    console.log(`  id:             ${assignment.id}`);
    console.log(`  program/module: ${assignment.module.program.name} / ${assignment.module.title}`);
    console.log(`  maxAttempts:    ${assignment.maxAttempts}`);
    console.log(`  allowGithubUrl: ${assignment.allowGithubUrl}`);
    console.log(`  dueAt:          ${assignment.dueAt ? assignment.dueAt.toISOString().slice(0, 10) : "none"}`);
    console.log(`  URL:            /learn/assignments/${assignment.id}`);
    console.log();
  }

  console.log("=".repeat(70));
  console.log("SUBMISSIONS");
  console.log("=".repeat(70));
  for (const submission of submissions) {
    console.log(
      `${submission.assignment.title} — ${submission.enrollment.user.name}  attempt ${submission.attemptNumber}  [${submission.status}]`,
    );
    console.log(`  id:  ${submission.id}`);
    console.log(`  URL: /learn/submissions/${submission.id}`);
    console.log();
  }

  console.log("=".repeat(70));
  console.log("MENTORS");
  console.log("=".repeat(70));
  for (const mentor of mentors) {
    console.log(`${mentor.name}  (${mentor.email})`);
    if (mentor.mentorAssignments.length === 0) {
      console.log(`  batches: none assigned`);
    } else {
      for (const assignment of mentor.mentorAssignments) {
        console.log(`  batch: ${assignment.batch.code} — ${assignment.batch.program.name}  [${assignment.roleLabel}]`);
      }
    }
    console.log();
  }

  console.log("=".repeat(70));
  console.log("CERTIFICATES");
  console.log("=".repeat(70));
  for (const certificate of certificates) {
    console.log(`${certificate.certificateNumber}  [${certificate.status}]`);
    console.log(`  learner: ${certificate.user.name}`);
    console.log(`  program: ${certificate.program.name}`);
    console.log(`  URL:     /verify/${certificate.certificateNumber}`);
    console.log();
  }

  console.log("=".repeat(70));
  console.log("LEARNER ACCOUNTS (one GRANTED per program + one AWAITING)");
  console.log("=".repeat(70));
  for (const enrollment of grantedPerProgram) {
    console.log(`GRANTED  — ${enrollment.program.name.padEnd(28)} ${enrollment.user.email}`);
  }
  if (awaiting) {
    console.log(`AWAITING — ${awaiting.program.name.padEnd(28)} ${awaiting.user.email}`);
  }
  console.log();
  console.log(`Dev password for every seeded user: ${DEV_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
