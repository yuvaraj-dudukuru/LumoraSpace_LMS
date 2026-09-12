// Exercises the M4 3b certificate queries (src/lib/queries/certificates.ts)
// against the real seeded DB — read-only, mutates nothing.
//
// getCertificateForVerification backs the PUBLIC /verify/[certificateNumber]
// route, so this asserts its return shape has EXACTLY the 4 allowed keys —
// not just "the right fields are present" but "no other fields leaked".
//
// queries/certificates.ts imports "server-only", which throws outside Next's
// bundler unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-certificates.ts
import { PrismaClient } from "@prisma/client";
import {
  getCertificatesForUser,
  getCertificateDetailForUser,
  getCertificateForVerification,
} from "../src/lib/queries/certificates";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [noah, grace] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "noah.andersen@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "grace.mwangi@example.com" } }),
  ]);

  // 1. getCertificatesForUser finds Noah's real seeded certificate.
  const noahCertificates = await getCertificatesForUser(noah.id);
  const noahCert = noahCertificates.find((c) => c.certificateNumber === "LUM-2026-00201");
  record(
    "getCertificatesForUser(Noah) includes LUM-2026-00201",
    noahCert !== undefined,
    `found=${noahCertificates.map((c) => c.certificateNumber).join(",")}`,
  );
  if (!noahCert) throw new Error("Fixture assumption broken: LUM-2026-00201 not found for Noah Andersen");

  // 2. getCertificateDetailForUser round-trips ownership correctly.
  const detail = await getCertificateDetailForUser(noahCert.id);
  record(
    "getCertificateDetailForUser: userId matches Noah (ownership check would pass)",
    detail?.userId === noah.id,
    `userId=${detail?.userId}`,
  );
  record(
    "getCertificateDetailForUser: userId does NOT match Grace (ownership check would 403)",
    detail?.userId !== grace.id,
  );

  // 3. Public verification lookup: correct data...
  const verified = await getCertificateForVerification("LUM-2026-00201");
  record(
    "getCertificateForVerification(LUM-2026-00201): correct learner/program/status",
    verified?.learnerName === "Noah Andersen" &&
      verified.programName.length > 0 &&
      verified.status === "VALID",
    JSON.stringify(verified),
  );

  // ...and ONLY the 4 allowed keys — no userId/email/batch/enrollment leak.
  const keys = verified ? Object.keys(verified).sort() : [];
  const expectedKeys = ["issuedAt", "learnerName", "programName", "status"];
  record(
    "getCertificateForVerification return shape has EXACTLY {learnerName, programName, issuedAt, status}",
    JSON.stringify(keys) === JSON.stringify(expectedKeys),
    `keys=${keys.join(",")}`,
  );

  // 4. Nonexistent certificate number returns null, not a throw.
  const missing = await getCertificateForVerification("LUM-2026-99999");
  record("getCertificateForVerification(nonexistent) returns null", missing === null);

  console.log("verify-certificates results:\n");
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
