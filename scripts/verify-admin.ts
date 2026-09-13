// Exercises M5c's certificate issuance and self-lockout guards against the
// real seeded DB — read-only except for issueCertificateIfEligible, which is
// itself idempotent (calling it on an enrollment that already has a VALID
// certificate, or that isn't at 100%, is a guaranteed no-op).
//
// certificates.ts imports "server-only", which throws outside Next's bundler
// unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-admin.ts
// NOTE: this script deliberately does NOT import from src/lib/auth-guards.ts
// (which pulls in next/navigation) — that module is incompatible with the
// react-server export condition required below by "server-only", since
// next/navigation's router context needs full React, not the react-server
// build. The SUSPENDED-blocks-access check that would naturally live here
// instead extends scripts/verify-guards.ts, which already imports
// auth-guards.ts and runs WITHOUT this condition.
import { PrismaClient } from "@prisma/client";
import { issueCertificateIfEligible } from "../src/lib/certificates";
import { wouldSelfDemote, wouldSelfDeactivate } from "../src/lib/validations/admin";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [admin, otherAdminCandidate, weiZhang, noah, grace] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@lumoraspace.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "michael.chen@lumoraspace.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "wei.zhang@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "noah.andersen@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "grace.mwangi@example.com" } }),
  ]);

  const [weiEnrollment, noahEnrollment, graceEnrollment] = await Promise.all([
    prisma.enrollment.findFirstOrThrow({ where: { userId: weiZhang.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: noah.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: grace.id } }),
  ]);

  // 1. issueCertificateIfEligible is a no-op below 100% (Wei Zhang is ~94%
  // in the real seed — a real "not there yet" case, not fabricated).
  if (weiEnrollment.progressPercent === 100) {
    throw new Error("Fixture assumption broken: Wei Zhang is already at 100% — pick a different in-progress learner.");
  }
  const weiResult = await issueCertificateIfEligible(weiEnrollment.id);
  record(
    "issueCertificateIfEligible is a no-op below 100% progress (Wei Zhang)",
    weiResult === null,
    `progressPercent=${weiEnrollment.progressPercent}`,
  );

  // 2. Idempotent: calling it twice on an already-COMPLETED, already-VALID
  // enrollment (Noah Andersen, real seeded certificate LUM-2026-00201) both
  // times yields no NEW certificate — refuses a second VALID cert.
  const noahCertsBefore = await prisma.certificate.count({ where: { userId: noah.id, status: "VALID" } });
  const noahFirstCall = await issueCertificateIfEligible(noahEnrollment.id);
  const noahSecondCall = await issueCertificateIfEligible(noahEnrollment.id);
  const noahCertsAfter = await prisma.certificate.count({ where: { userId: noah.id, status: "VALID" } });
  record(
    "issueCertificateIfEligible refuses a second VALID cert for the same user+program (Noah Andersen)",
    noahFirstCall === null && noahSecondCall === null && noahCertsAfter === noahCertsBefore,
    `before=${noahCertsBefore} after=${noahCertsAfter}`,
  );

  // 3. Same idempotency check against a second real completed learner (Grace
  // Mwangi) — confirms it's not a Noah-specific coincidence.
  const graceCertsBefore = await prisma.certificate.count({ where: { userId: grace.id, status: "VALID" } });
  await issueCertificateIfEligible(graceEnrollment.id);
  const graceCertsAfter = await prisma.certificate.count({ where: { userId: grace.id, status: "VALID" } });
  record(
    "issueCertificateIfEligible is idempotent for Grace Mwangi too (calling it again yields no new cert)",
    graceCertsAfter === graceCertsBefore,
    `before=${graceCertsBefore} after=${graceCertsAfter}`,
  );

  // 4. Certificate number format and uniqueness across the whole real table.
  const allCertificates = await prisma.certificate.findMany({ select: { certificateNumber: true } });
  const numberPattern = /^LUM-\d{4}-\d{5}$/;
  const allMatchFormat = allCertificates.every((c) => numberPattern.test(c.certificateNumber));
  record(
    "Every certificate number matches LUM-{year}-{5-digit sequence}",
    allMatchFormat,
    `sample=${allCertificates[0]?.certificateNumber}`,
  );
  const uniqueNumbers = new Set(allCertificates.map((c) => c.certificateNumber));
  record(
    "Certificate numbers are unique across the whole table",
    uniqueNumbers.size === allCertificates.length,
    `total=${allCertificates.length} unique=${uniqueNumbers.size}`,
  );

  // 5. An admin cannot demote themselves — pure check, no DB.
  record(
    "wouldSelfDemote(admin, admin, MENTOR) is true — blocks self-demotion",
    wouldSelfDemote(admin.id, admin.id, "MENTOR") === true,
  );
  record(
    "wouldSelfDemote(admin, someone else, MENTOR) is false — changing another user's role is fine",
    wouldSelfDemote(admin.id, otherAdminCandidate.id, "MENTOR") === false,
  );
  record(
    "wouldSelfDemote(admin, admin, ADMIN) is false — re-affirming your own ADMIN role isn't a demotion",
    wouldSelfDemote(admin.id, admin.id, "ADMIN") === false,
  );

  // 6. Same lockout class, one field over: self-deactivation.
  record(
    "wouldSelfDeactivate(admin, admin, INACTIVE) is true — blocks self-deactivation",
    wouldSelfDeactivate(admin.id, admin.id, "INACTIVE") === true,
  );
  record(
    "wouldSelfDeactivate(admin, someone else, INACTIVE) is false",
    wouldSelfDeactivate(admin.id, otherAdminCandidate.id, "INACTIVE") === false,
  );

  // Note: the "requireGrantedEnrollment blocks SUSPENDED, not just AWAITING"
  // check lives in scripts/verify-guards.ts instead of here — it exercises
  // src/lib/auth-guards.ts's isEnrollmentGranted, which imports
  // next/navigation and can't share a process with this script's
  // "server-only"-gated imports (see the top-of-file note).

  console.log("verify-admin results:\n");
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
