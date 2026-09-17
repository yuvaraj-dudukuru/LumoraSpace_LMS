// No-DB checks for the pure learner-facing logic in src/lib:
//   - learner-status.ts   deriveLearnerStatus / elapsedPercent (Phase A step 1)
// Fixed `now`, hand-built inputs, no Prisma, no env vars.
// Run: npx tsx scripts/verify-learner-logic.ts
import { deriveLearnerStatus, elapsedPercent, ON_TRACK_TOLERANCE_PERCENT } from "../src/lib/learner-status";

type Check = { name: string; pass: boolean; detail?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function main(): void {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  // A 10-week batch; "now" is 4 weeks in => 40% elapsed, so the on-track
  // threshold is exactly 30% (40 - ON_TRACK_TOLERANCE_PERCENT).
  const batchStart = new Date("2026-08-16T00:00:00Z");
  const batchEnd = new Date(batchStart.getTime() + 70 * DAY_MS);
  const now = new Date(batchStart.getTime() + 28 * DAY_MS);
  const base = { batchStart, batchEnd, now, enrollmentStatus: "ACTIVE" as const };

  record("elapsedPercent is 40 four weeks into a ten-week batch", elapsedPercent(batchStart, batchEnd, now) === 40, `elapsed=${elapsedPercent(batchStart, batchEnd, now)}`);
  record("elapsedPercent clamps to 0 before the batch starts", elapsedPercent(batchStart, batchEnd, new Date(batchStart.getTime() - DAY_MS)) === 0);
  record("elapsedPercent clamps to 100 after the batch ends", elapsedPercent(batchStart, batchEnd, new Date(batchEnd.getTime() + DAY_MS)) === 100);
  record("elapsedPercent is 100 (not NaN/Infinity) when end <= start", elapsedPercent(batchStart, batchStart, now) === 100);

  record("tolerance constant is 10", ON_TRACK_TOLERANCE_PERCENT === 10);

  record(
    "before the batch starts → NOT_STARTED",
    deriveLearnerStatus({ ...base, now: new Date(batchStart.getTime() - DAY_MS), progressPercent: 0 }) === "NOT_STARTED",
  );
  record(
    "40% elapsed, progress exactly at the −10 boundary (30) → ON_TRACK",
    deriveLearnerStatus({ ...base, progressPercent: 30 }) === "ON_TRACK",
  );
  record(
    "40% elapsed, progress 31.6 (seed: David Kim on seed day) → ON_TRACK",
    deriveLearnerStatus({ ...base, progressPercent: 31.6 }) === "ON_TRACK",
  );
  record(
    "40% elapsed, progress 29.9 → BEHIND",
    deriveLearnerStatus({ ...base, progressPercent: 29.9 }) === "BEHIND",
  );
  record(
    "40% elapsed, progress 15.8 (seed: Priya Sharma) → BEHIND",
    deriveLearnerStatus({ ...base, progressPercent: 15.8 }) === "BEHIND",
  );
  record(
    "enrollment COMPLETED at 60% progress → COMPLETED (status wins over pace)",
    deriveLearnerStatus({ ...base, progressPercent: 60, enrollmentStatus: "COMPLETED" }) === "COMPLETED",
  );
  record(
    "progress 100 on an ACTIVE enrollment → COMPLETED",
    deriveLearnerStatus({ ...base, progressPercent: 100 }) === "COMPLETED",
  );
  record(
    "after the batch ends with 85% → BEHIND (elapsed is 100, threshold 90)",
    deriveLearnerStatus({ ...base, now: new Date(batchEnd.getTime() + DAY_MS), progressPercent: 85 }) === "BEHIND",
  );
  record(
    "after the batch ends with 95% → ON_TRACK",
    deriveLearnerStatus({ ...base, now: new Date(batchEnd.getTime() + DAY_MS), progressPercent: 95 }) === "ON_TRACK",
  );
  record(
    "batch with end <= start at 50% progress → BEHIND, never throws",
    deriveLearnerStatus({ ...base, batchEnd: batchStart, progressPercent: 50 }) === "BEHIND",
  );
  record(
    "DROPPED enrollment still follows the pace rule (caller decides visibility)",
    deriveLearnerStatus({ ...base, progressPercent: 50, enrollmentStatus: "DROPPED" }) === "ON_TRACK",
  );

  console.log("verify-learner-logic results:\n");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }
  const failures = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
  if (failures.length > 0) process.exitCode = 1;
}

main();
