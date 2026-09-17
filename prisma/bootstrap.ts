// Production bootstrap — SEPARATE from seed.ts and never shares logic with
// it. seed.ts is a dev tool: idempotent, destructive (deletes and recreates
// everything), safe to rerun forever against a throwaway dev DB. This script
// is the opposite on every axis: it runs exactly ONCE against a real
// production database, refuses outright if that database already has any
// users, and never deletes a single row — a bug here must fail loudly and
// leave the DB untouched, never silently wipe real data.
//
// Run: npm run bootstrap
// Required env vars: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (12+
// chars), BOOTSTRAP_ADMIN_NAME. See DEPLOYMENT.md.
//
// If the database already has users (e.g. real signups happened before
// curriculum was loaded), this script refuses — see
// bootstrap-curriculum.ts for that situation instead.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
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

const envSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z
    .string()
    .trim()
    .toLowerCase()
    .email("BOOTSTRAP_ADMIN_EMAIL must be a valid email address"),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12, "BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters"),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1, "BOOTSTRAP_ADMIN_NAME is required"),
});

async function main(): Promise<void> {
  // 1. Refuse outright if the User table has ANY rows — checked first,
  // before touching env vars or the JSON file, so a misconfigured re-run
  // against a live database exits immediately with no side effects at all.
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    console.error(
      `Bootstrap refused: the User table already has ${existingUserCount} row(s). ` +
        "This script only runs once, against a fresh database. If you need to add " +
        "curriculum to a database that already has users, run bootstrap-curriculum.ts " +
        "instead; for an admin/mentor account, use /admin.",
    );
    process.exit(1);
  }

  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error("Bootstrap refused — invalid or missing environment variables:");
    for (const issue of env.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  const { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME } = env.data;

  // Validated (shape + every cross-reference rule) before any write.
  const data = loadBootstrapData();
  if (isTemplateData(data)) {
    console.error(TEMPLATE_REFUSAL_MESSAGE);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);

  const summary = await prisma.$transaction(
    async (tx) => {
      const admin = await tx.user.create({
        data: {
          name: BOOTSTRAP_ADMIN_NAME,
          email: BOOTSTRAP_ADMIN_EMAIL,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          onboardingComplete: true,
        },
      });

      const programs = [];
      for (const programDef of data.programs) {
        programs.push(await createCurriculum(tx, programDef));
      }
      return { adminEmail: admin.email, programs };
    },
    { timeout: BOOTSTRAP_TRANSACTION_TIMEOUT_MS },
  );

  console.log("Bootstrap complete:\n");
  console.log(`  Admin account:  ${summary.adminEmail}`);
  for (const program of summary.programs) {
    console.log("");
    printCurriculumSummary(program);
  }
  console.log("\nNothing was deleted. This script will refuse to run again while any User row exists.");
  console.log(`Sign in at ${loginUrlHint()}, then remove BOOTSTRAP_ADMIN_PASSWORD from your shell/env.`);
}

main()
  .catch((error: unknown) => {
    console.error("Bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
