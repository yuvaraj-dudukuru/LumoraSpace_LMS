// Phase A learner-experience checks against the real local seeded DB:
//   step 2 — getPendingWork / sortPendingWork per seeded learner
//   step 3 — getDashboardData().nextStep priority
//   step 4 — getDashboardData().recentActivity kinds (derived only, newest 10)
//   step 5 — getDashboardData().achievements (four derived kinds, zero omitted)
// Read-only. Assumes a FRESH seed (the SQL Optimization assignment is seeded
// one week past due; batch elapsed% drifts by the day, so pace assertions
// live in scripts/verify-learner-logic.ts with a fixed `now`, not here).
//
// queries/*.ts import "server-only", which throws outside Next's bundler
// unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-learner-dashboard.ts
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase } from "./assert-local-db";
import {
  getPendingWork,
  sortPendingWork,
  deriveAssessmentPending,
  type PendingWorkItem,
} from "../src/lib/queries/pending-work";
import { getDashboardData } from "../src/lib/queries/dashboard";

// First, before the client exists — never against a non-local DB.
assertLocalDatabase();

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

function summarize(items: PendingWorkItem[]): string {
  return items.map((i) => `${i.kind}:${i.title}=${i.state}/${i.action}`).join(" | ") || "(none)";
}

async function enrollmentFor(email: string, programSlug: string): Promise<string> {
  const enrollment = await prisma.enrollment.findFirstOrThrow({
    where: { user: { email }, program: { slug: programSlug } },
    select: { id: true },
  });
  return enrollment.id;
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }
  const now = new Date();
  const FDA = "forge-data-analyst";
  const FSD = "forge-full-stack-developer";

  // ---- Step 2: pending work -------------------------------------------------
  const alex = sortPendingWork(await getPendingWork(await enrollmentFor("alex.morgan@example.com", FDA), now));
  const alexSql = alex.find((i) => i.title === "SQL Optimization");
  record(
    "Alex: SQL Optimization is completed → View feedback → /learn/submissions/{id}",
    alexSql?.state === "completed" && alexSql.action === "view_feedback" && alexSql.href.startsWith("/learn/submissions/"),
    summarize(alex),
  );
  record(
    "Alex: Data Cleaning Assignment is not_started → Start (due in the future)",
    alex.find((i) => i.title === "Data Cleaning Assignment")?.state === "not_started",
  );
  record(
    "Alex: the passed SQL Fundamentals Assessment is excluded from pending work",
    !alex.some((i) => i.kind === "assessment"),
  );

  const aisha = sortPendingWork(await getPendingWork(await enrollmentFor("aisha.patel@example.com", FDA), now));
  record(
    "Aisha: SQL Optimization is under_review → Continue",
    aisha.find((i) => i.title === "SQL Optimization")?.state === "under_review" &&
      aisha.find((i) => i.title === "SQL Optimization")?.action === "continue",
    summarize(aisha),
  );
  record(
    "Aisha: never-attempted GRADED assessment is not_started → Start → /learn/assessments/{id}",
    aisha.some((i) => i.kind === "assessment" && i.state === "not_started" && i.action === "start" && i.href.startsWith("/learn/assessments/")),
  );

  const david = sortPendingWork(await getPendingWork(await enrollmentFor("david.kim@example.com", FDA), now));
  record(
    "David: SQL Optimization is submitted → Continue",
    david.find((i) => i.title === "SQL Optimization")?.state === "submitted",
    summarize(david),
  );
  record(
    "David: failed GRADED assessment with 1 of 2 attempts left → Resubmit → /learn/assessments/{id}",
    david.some((i) => i.kind === "assessment" && i.action === "resubmit" && i.href.startsWith("/learn/assessments/")),
  );

  const marcus = sortPendingWork(await getPendingWork(await enrollmentFor("marcus.wei@example.com", FDA), now));
  record(
    "Marcus: revision_requested (Data Cleaning) sorts first → Resubmit",
    marcus[0]?.title === "Data Cleaning Assignment" && marcus[0].state === "revision_requested" && marcus[0].action === "resubmit",
    summarize(marcus),
  );
  record(
    "Marcus: overdue SQL Optimization (never submitted, due a week ago) sorts second → Start",
    marcus[1]?.title === "SQL Optimization" && marcus[1].state === "overdue" && marcus[1].action === "start",
  );

  const priya = sortPendingWork(await getPendingWork(await enrollmentFor("priya.sharma@example.com", FDA), now));
  record(
    "Priya: overdue SQL Optimization sorts first; her NOT_STARTED placeholder on Data Cleaning reads as not_started",
    priya[0]?.title === "SQL Optimization" && priya[0].state === "overdue" &&
      priya.find((i) => i.title === "Data Cleaning Assignment")?.state === "not_started",
    summarize(priya),
  );
  record(
    "Priya: completed items would sort last, open items by due date, no-due-date assessment after dated ones",
    priya.map((i) => i.state).join(",") === "overdue,not_started,not_started" && priya[2]?.kind === "assessment",
    priya.map((i) => `${i.state}:${i.dueAt ? i.dueAt.toISOString().slice(0, 10) : "none"}`).join(" | "),
  );

  const wei = await getPendingWork(await enrollmentFor("wei.zhang@example.com", FSD), now);
  record(
    "Wei Zhang: Full Stack has no assignments and only a PRACTICE assessment → empty",
    wei.length === 0,
    summarize(wei),
  );

  // Pure branch the seed can't produce: failed with no attempts remaining.
  const exhausted = deriveAssessmentPending(
    "a1",
    [
      { id: "att2", status: "GRADED", passed: false },
      { id: "att1", status: "GRADED", passed: false },
    ],
    2,
    70,
  );
  record(
    "deriveAssessmentPending: failed with no attempts left → completed / View feedback → latest attempt",
    exhausted?.state === "completed" && exhausted.action === "view_feedback" && exhausted.href === "/learn/attempts/att2",
  );
  record(
    "deriveAssessmentPending: no threshold + any graded attempt counts as passed (null)",
    deriveAssessmentPending("a2", [{ id: "x", status: "GRADED", passed: null }], 0, null) === null,
  );
  record(
    "deriveAssessmentPending: IN_PROGRESS attempt → Continue → /learn/attempts/{id}",
    deriveAssessmentPending("a3", [{ id: "live", status: "IN_PROGRESS", passed: null }], 1, 70)?.href === "/learn/attempts/live",
  );

  // ---- Step 3: next step priority (through the real getDashboardData) -----
  async function nextStepFor(email: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, name: true, streakDays: true } });
    const data = await getDashboardData(user);
    return data?.nextStep ?? null;
  }
  const marcusStep = await nextStepFor("marcus.wei@example.com");
  record(
    "Marcus: next step is the revision-requested Data Cleaning Assignment (beats his overdue item) → Continue",
    marcusStep?.kind === "assignment" && marcusStep.reason === "revision_requested" && marcusStep.action === "continue",
    JSON.stringify(marcusStep),
  );
  const priyaStep = await nextStepFor("priya.sharma@example.com");
  record(
    "Priya: next step is the overdue SQL Optimization → Start",
    priyaStep?.kind === "assignment" && priyaStep.reason === "overdue" && priyaStep.action === "start",
    JSON.stringify(priyaStep),
  );
  const alexStep = await nextStepFor("alex.morgan@example.com");
  record(
    "Alex: nothing urgent (Data Cleaning due in 2 weeks) → next incomplete lesson with its durationMins",
    alexStep?.kind === "lesson" && alexStep.reason === "next_lesson" && alexStep.href.startsWith("/learn/lessons/"),
    JSON.stringify(alexStep),
  );

  // ---- Step 4: recent activity kinds ----------------------------------------
  async function dashboardFor(email: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, name: true, streakDays: true } });
    return getDashboardData(user);
  }
  const alexDash = await dashboardFor("alex.morgan@example.com");
  const alexActivity = alexDash?.recentActivity ?? [];
  const alexAssessment = alexActivity.find((a) => a.kind === "assessment_submitted");
  record(
    "Alex: activity has assessment_submitted with scorePercent 87.5 and passed=true",
    alexAssessment?.kind === "assessment_submitted" && alexAssessment.scorePercent === 87.5 && alexAssessment.passed === true,
    alexActivity.map((a) => a.kind).join(","),
  );
  const alexReviewed = alexActivity.find((a) => a.kind === "submission_reviewed");
  record(
    "Alex: activity has submission_reviewed with outcome APPROVED",
    alexReviewed?.kind === "submission_reviewed" && alexReviewed.outcome === "APPROVED",
  );
  record(
    "Alex: activity has at least one module_completed (Module 1 is at 100% for a 12/19 learner)",
    alexActivity.some((a) => a.kind === "module_completed"),
  );
  record(
    "Activity is newest-first and capped at 10",
    alexActivity.length <= 10 &&
      alexActivity.every((a, i) => i === 0 || alexActivity[i - 1].occurredAt.getTime() >= a.occurredAt.getTime()),
    `count=${alexActivity.length}`,
  );

  const marcusDash = await dashboardFor("marcus.wei@example.com");
  const marcusReviewed = marcusDash?.recentActivity.find((a) => a.kind === "submission_reviewed");
  record(
    "Marcus: activity has submission_reviewed with outcome REVISION_REQUESTED",
    marcusReviewed?.kind === "submission_reviewed" && marcusReviewed.outcome === "REVISION_REQUESTED",
  );

  // Noah's only enrollment is COMPLETED — Phase A widened the dashboard pick
  // to GRANTED ACTIVE-or-COMPLETED so he still gets a dashboard.
  const noahDash = await dashboardFor("noah.andersen@example.com");
  const noahActivity = noahDash?.recentActivity ?? [];
  record(
    "Noah (COMPLETED enrollment): dashboard renders (not the empty state), learnerStatus COMPLETED, no next step",
    noahDash !== null && noahDash.learnerStatus === "COMPLETED" && noahDash.nextStep === null,
    noahDash ? `status=${noahDash.learnerStatus} nextStep=${JSON.stringify(noahDash.nextStep)}` : "null",
  );
  const noahCert = noahActivity.find((a) => a.kind === "certificate_issued");
  record(
    "Noah: activity has certificate_issued LUM-2026-00201",
    noahCert?.kind === "certificate_issued" && noahCert.certificateNumber === "LUM-2026-00201",
    noahActivity.map((a) => a.kind).join(","),
  );
  record(
    "Noah: activity has 4 module_completed items (every Full Stack module is at 100%)",
    noahActivity.filter((a) => a.kind === "module_completed").length === 4,
  );

  // ---- Step 5: achievements (derived only) ----------------------------------
  const alexAchievements = alexDash?.achievements ?? [];
  const byKind = (kind: string) => alexAchievements.find((a) => a.kind === kind)?.count ?? 0;
  record(
    "Alex: achievements = 9-day streak, 2 modules completed, 1 graded assessment passed; no certificates chip",
    byKind("streak") === 9 && byKind("modules_completed") === 2 && byKind("graded_assessments_passed") === 1 &&
      !alexAchievements.some((a) => a.kind === "certificates"),
    alexAchievements.map((a) => `${a.kind}=${a.count}`).join(","),
  );
  const noahAchievements = noahDash?.achievements ?? [];
  record(
    "Noah: achievements include 1 certificate and 4 modules completed; no graded-assessment chip (Full Stack has none)",
    noahAchievements.find((a) => a.kind === "certificates")?.count === 1 &&
      noahAchievements.find((a) => a.kind === "modules_completed")?.count === 4 &&
      !noahAchievements.some((a) => a.kind === "graded_assessments_passed"),
    noahAchievements.map((a) => `${a.kind}=${a.count}`).join(","),
  );
  record(
    "Achievement labels are built from their counts only (no invented badge names)",
    alexAchievements.every((a) => a.label.startsWith(String(a.count))),
    alexAchievements.map((a) => a.label).join(" | "),
  );

  console.log("verify-learner-dashboard results:\n");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? `\n      (${check.detail})` : ""}`);
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
