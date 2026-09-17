// No-DB checks for the pure learner-facing logic in src/lib:
//   - learner-status.ts   deriveLearnerStatus / elapsedPercent (Phase A step 1)
//   - next-step.ts        pickNextStep priority               (Phase A step 3)
// Fixed `now`, hand-built inputs, no Prisma, no env vars. (Only `import type`
// from the server-only query modules, so "server-only" is never evaluated.)
// Run: npx tsx scripts/verify-learner-logic.ts
import { deriveLearnerStatus, elapsedPercent, ON_TRACK_TOLERANCE_PERCENT } from "../src/lib/learner-status";
import { pickNextStep, DUE_SOON_DAYS } from "../src/lib/next-step";
import type { PendingWorkItem } from "../src/lib/queries/pending-work";
import type { LessonProgressSummary } from "../src/lib/queries/progress";

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

  // ---- Step 3: pickNextStep priority ----------------------------------------
  function item(overrides: Partial<PendingWorkItem> & { title: string }): PendingWorkItem {
    return {
      kind: "assignment",
      id: overrides.title,
      moduleTitle: "Module",
      moduleOrder: 1,
      assignmentType: "ASSIGNMENT",
      dueAt: null,
      estimatedMins: 60,
      state: "not_started",
      action: "start",
      href: `/learn/assignments/${overrides.title}`,
      ...overrides,
    };
  }
  const lesson: { moduleId: string; lesson: LessonProgressSummary } = {
    moduleId: "m1",
    lesson: { id: "l1", title: "Lesson One", type: "VIDEO", order: 1, durationMins: 12, completed: false, completedAt: null, assessmentId: null, attemptState: null },
  };
  const inDays = (days: number) => new Date(now.getTime() + days * DAY_MS);
  const revision = item({ title: "Revise me", state: "revision_requested", action: "resubmit", dueAt: inDays(10) });
  const overdue = item({ title: "Late", state: "overdue", dueAt: inDays(-2) });
  const dueIn2 = item({ title: "Soon", dueAt: inDays(2) });
  const dueIn5 = item({ title: "Later", dueAt: inDays(5) });
  const assessment = item({ title: "Quiz", kind: "assessment", assignmentType: null });

  const s1 = pickNextStep([dueIn2, overdue, revision, dueIn5], lesson, now);
  record("revision requested beats overdue, due-soon and the lesson → Continue", s1?.kind === "assignment" && s1.reason === "revision_requested" && s1.action === "continue" && s1.id === "Revise me", JSON.stringify(s1));
  const s2 = pickNextStep([dueIn2, overdue, dueIn5], lesson, now);
  record("overdue beats due-soon and the lesson → Start", s2?.kind === "assignment" && s2.reason === "overdue" && s2.action === "start" && s2.id === "Late");
  const s3 = pickNextStep([dueIn5, dueIn2], lesson, now);
  record(`due within ${DUE_SOON_DAYS} days beats the lesson; the nearer due date wins`, s3?.kind === "assignment" && s3.reason === "due_soon" && s3.id === "Soon");
  const s4 = pickNextStep([dueIn5], lesson, now);
  record("an assignment due in 5 days is not 'due soon' → the next incomplete lesson wins", s4?.kind === "lesson" && s4.id === "l1" && s4.durationMins === 12 && s4.href === "/learn/lessons/l1");
  const s5 = pickNextStep([assessment], lesson, now);
  record("assessments never become the next step", s5?.kind === "lesson");
  const s6 = pickNextStep([item({ title: "Done", state: "completed", action: "view_feedback", dueAt: inDays(-30) })], null, now);
  record("completed work + no lesson left → null", s6 === null);
  const s7 = pickNextStep([item({ title: "Submitted", state: "submitted", action: "continue", dueAt: inDays(1) })], lesson, now);
  record("a submitted assignment due tomorrow is not 'due soon' (nothing left to submit) → lesson", s7?.kind === "lesson");

  console.log("verify-learner-logic results:\n");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }
  const failures = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
  if (failures.length > 0) process.exitCode = 1;
}

main();
