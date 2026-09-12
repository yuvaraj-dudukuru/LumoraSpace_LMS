// Asserts the pure predicate logic in src/lib/auth-guards.ts against the real
// seeded DB. requireGrantedEnrollment/requireMentorForBatch have no page call
// site yet (that's M3), so this is how they get exercised for M2 — real
// Prisma queries against the actual seed data, not a simulated/faked result.
//
// Run: npx tsx scripts/verify-guards.ts  (needs the seeded dev DB up — see
// docker-compose.yml / `npx prisma db seed`)
import { PrismaClient } from "@prisma/client";
import { findEnrollment, isEnrollmentGranted, isMentorForBatch } from "../src/lib/auth-guards";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];

  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [alex, daniel, admin, michael] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "daniel.osei@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "admin@lumoraspace.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "michael.chen@lumoraspace.dev" } }),
  ]);

  const [forgeDataAnalyst, forgeFullStack] = await Promise.all([
    prisma.program.findUniqueOrThrow({ where: { slug: "forge-data-analyst" } }),
    prisma.program.findUniqueOrThrow({ where: { slug: "forge-full-stack-developer" } }),
  ]);

  const [assignedBatch, unassignedBatch] = await Promise.all([
    prisma.batch.findUniqueOrThrow({ where: { code: "FDA-B04" } }), // Michael Chen is Lead Instructor here
    prisma.batch.findUniqueOrThrow({ where: { code: "FDA-B05" } }), // upcoming batch, no MentorAssignment rows seeded
  ]);

  // 1. GRANTED learner passes for their program.
  const alexEnrollment = await findEnrollment(alex.id, forgeDataAnalyst.id);
  record(
    "GRANTED learner (Alex Morgan) passes for Forge Data Analyst",
    isEnrollmentGranted(alexEnrollment) === true,
    `enrollment=${alexEnrollment ? alexEnrollment.accessState : "null"}`,
  );

  // 2. AWAITING learner fails for their program.
  const danielEnrollment = await findEnrollment(daniel.id, forgeDataAnalyst.id);
  record(
    "AWAITING learner (Daniel Osei) fails for Forge Data Analyst",
    isEnrollmentGranted(danielEnrollment) === false,
    `enrollment=${danielEnrollment ? danielEnrollment.accessState : "null"}`,
  );

  // 3. Learner with no enrollment in that program fails.
  const alexOtherProgramEnrollment = await findEnrollment(alex.id, forgeFullStack.id);
  record(
    "Learner with no enrollment (Alex Morgan x Forge Full Stack Developer) fails",
    isEnrollmentGranted(alexOtherProgramEnrollment) === false,
    `enrollment=${alexOtherProgramEnrollment ? alexOtherProgramEnrollment.accessState : "null"}`,
  );

  // 4. Mentor assigned to a batch passes requireMentorForBatch.
  const michaelAssigned = await isMentorForBatch(michael, assignedBatch.id);
  record(
    "Mentor (Michael Chen) assigned to FDA-B04 passes requireMentorForBatch",
    michaelAssigned === true,
  );

  // 5. Mentor NOT assigned to that batch fails.
  const michaelUnassigned = await isMentorForBatch(michael, unassignedBatch.id);
  record(
    "Mentor (Michael Chen) NOT assigned to FDA-B05 fails requireMentorForBatch",
    michaelUnassigned === false,
  );

  // 6. Admin passes requireMentorForBatch for any batch.
  const adminPasses = await isMentorForBatch(admin, unassignedBatch.id);
  record(
    "Admin passes requireMentorForBatch for any batch (FDA-B05, unassigned)",
    adminPasses === true,
  );

  console.log("verify-guards results:\n");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }

  const failures = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failures.length}/${checks.length} passed`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
