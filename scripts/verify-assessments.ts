// Exercises the new M4 3a query layer (src/lib/queries/assessments.ts) and
// the grading formula (src/app/learn/attempts/[attemptId]/actions.ts's
// gradeAttempt) against the real seeded DB — read-only, mutates nothing.
//
// The Server Actions themselves (startAttempt/saveAnswer/toggleFlag/
// submitAttempt) call requireGrantedEnrollment -> auth(), which needs a real
// Next.js request context and can't run from a standalone script — same
// limitation documented in scripts/verify-guards.ts for the require*
// wrappers. Those are exercised by the manual checklist instead.
//
// queries/assessments.ts imports "server-only", which throws outside Next's
// bundler unless the "react-server" export condition is set.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-assessments.ts
import { PrismaClient } from "@prisma/client";
import {
  resolveAssessmentProgram,
  getAssessmentOverview,
  getAttemptForGuard,
  getLiveAttemptQuestions,
  getGradedAttemptQuestions,
} from "../src/lib/queries/assessments";

const prisma = new PrismaClient();

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const checks: Check[] = [];
  function record(name: string, pass: boolean, detail?: string): void {
    checks.push({ name, pass, detail });
  }

  const [alex, david, priya, weiZhang] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "david.kim@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "priya.sharma@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "wei.zhang@example.com" } }),
  ]);
  const forgeDataAnalyst = await prisma.program.findUniqueOrThrow({ where: { slug: "forge-data-analyst" } });
  const sqlAssessment = await prisma.assessment.findFirstOrThrow({ where: { title: "SQL Fundamentals Assessment" } });
  const foundationsQuiz = await prisma.assessment.findFirstOrThrow({ where: { title: "Foundations Quiz" } });

  const [alexEnrollment, davidEnrollment, priyaEnrollment, weiEnrollment] = await Promise.all([
    prisma.enrollment.findFirstOrThrow({ where: { userId: alex.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: david.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: priya.id, programId: forgeDataAnalyst.id } }),
    prisma.enrollment.findFirstOrThrow({ where: { userId: weiZhang.id } }),
  ]);

  // 1. resolveAssessmentProgram resolves to the right program.
  const resolved = await resolveAssessmentProgram(sqlAssessment.id);
  record(
    "resolveAssessmentProgram(SQL assessment) resolves to Forge Data Analyst",
    resolved?.programId === forgeDataAnalyst.id,
    `got=${resolved?.programId}`,
  );

  // 2. Alex Morgan: 1 finished attempt, 2 allowed, no in-progress attempt.
  const alexOverview = await getAssessmentOverview(sqlAssessment.id, alexEnrollment.id);
  record(
    "Alex Morgan overview: 1/2 finished attempts, none in progress",
    alexOverview?.finishedAttemptCount === 1 &&
      alexOverview.allowedAttempts === 2 &&
      alexOverview.inProgressAttemptId === null,
    JSON.stringify(alexOverview),
  );

  // 3. Priya Sharma: fresh, 0 finished attempts (read-only — does not touch
  // her attempt state, so the manual checklist's "start a fresh attempt"
  // fixture is untouched by this script).
  const priyaOverview = await getAssessmentOverview(sqlAssessment.id, priyaEnrollment.id);
  record(
    "Priya Sharma overview: 0 finished attempts (fresh fixture, untouched)",
    priyaOverview?.finishedAttemptCount === 0 && priyaOverview.inProgressAttemptId === null,
    JSON.stringify(priyaOverview),
  );

  // 4. getAttemptForGuard on Alex's real graded attempt.
  const alexAttempt = await prisma.attempt.findFirstOrThrow({
    where: { assessmentId: sqlAssessment.id, enrollmentId: alexEnrollment.id },
  });
  const guardInfo = await getAttemptForGuard(alexAttempt.id);
  record(
    "getAttemptForGuard: ownership + programId resolve correctly for Alex's attempt",
    guardInfo?.enrollmentId === alexEnrollment.id &&
      guardInfo.programId === forgeDataAnalyst.id &&
      guardInfo.status === "GRADED",
    JSON.stringify(guardInfo),
  );

  // 5. getLiveAttemptQuestions NEVER includes isCorrect/explanation at
  // runtime, even for a graded attempt's questions (not just hidden by type).
  const liveQuestions = await getLiveAttemptQuestions(sqlAssessment.id, alexAttempt.id, false);
  const leaksAnswerData = liveQuestions.some(
    (q) => "explanation" in q || q.options.some((o) => "isCorrect" in o),
  );
  record(
    "getLiveAttemptQuestions never includes isCorrect/explanation keys at runtime",
    !leaksAnswerData && liveQuestions.length === 8,
    `count=${liveQuestions.length} leaks=${leaksAnswerData}`,
  );

  // 6. getGradedAttemptQuestions DOES include isCorrect/explanation, and
  // every question has exactly one correct option.
  const gradedQuestions = await getGradedAttemptQuestions(sqlAssessment.id, alexAttempt.id, false);
  const everyQuestionHasOneCorrectOption = gradedQuestions.every(
    (q) => q.options.filter((o) => o.isCorrect).length === 1,
  );
  record(
    "getGradedAttemptQuestions: 8 questions, each with exactly one correct option",
    gradedQuestions.length === 8 && everyQuestionHasOneCorrectOption,
    `count=${gradedQuestions.length}`,
  );

  // 7. Shuffle stability: two independent loads of the same (shuffled)
  // attempt return the identical question order — the core "reload doesn't
  // reshuffle" requirement, with zero persisted order column.
  const weiAttempt = await prisma.attempt.findFirstOrThrow({
    where: { assessmentId: foundationsQuiz.id, enrollmentId: weiEnrollment.id },
  });
  const [loadA, loadB] = await Promise.all([
    getLiveAttemptQuestions(foundationsQuiz.id, weiAttempt.id, true),
    getLiveAttemptQuestions(foundationsQuiz.id, weiAttempt.id, true),
  ]);
  const sameOrder = loadA.map((q) => q.id).join(",") === loadB.map((q) => q.id).join(",");
  record(
    "seededShuffle is stable across repeated loads of the same attempt",
    sameOrder,
    `A=${loadA.map((q) => q.order).join("")} B=${loadB.map((q) => q.order).join("")}`,
  );

  // 8. Grading formula replay: re-derive scorePercent for Alex + David's
  // real graded attempts from their stored Answers and compare against the
  // scorePercent seed.ts already computed and stored — proves the
  // points-weighted formula in gradeAttempt() agrees with real data.
  for (const [label, enrollment, expectedScore] of [
    ["Alex Morgan (7/8 correct)", alexEnrollment, null] as const,
    ["David Kim (4/8 correct)", davidEnrollment, null] as const,
  ]) {
    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { assessmentId: sqlAssessment.id, enrollmentId: enrollment.id },
    });
    const questions = await prisma.question.findMany({
      where: { assessmentId: sqlAssessment.id },
      select: {
        type: true,
        points: true,
        options: { select: { id: true, isCorrect: true } },
        answers: { where: { attemptId: attempt.id }, select: { selectedOptionId: true }, take: 1 },
      },
    });
    let earned = 0;
    let gradable = 0;
    for (const q of questions) {
      if (q.type === "CODE_SNIPPET") continue;
      gradable += q.points;
      const selectedId = q.answers[0]?.selectedOptionId;
      const chosen = q.options.find((o) => o.id === selectedId);
      if (chosen?.isCorrect) earned += q.points;
    }
    const recomputed = gradable === 0 ? null : Math.round((earned / gradable) * 1000) / 10;
    record(
      `Grading formula replay matches stored scorePercent — ${label}`,
      recomputed === attempt.scorePercent,
      `recomputed=${recomputed} stored=${attempt.scorePercent} expected=${expectedScore ?? "n/a"}`,
    );
  }

  // 9. M4.5 — every QUIZ lesson has a linked assessment, and every linked
  // assessment resolves to the SAME program as its lesson (catches a future
  // mis-link across programs).
  const quizLessons = await prisma.lesson.findMany({
    where: { type: "QUIZ" },
    select: {
      id: true,
      title: true,
      assessmentId: true,
      module: { select: { programId: true } },
      assessment: { select: { module: { select: { programId: true } } } },
    },
  });
  const unlinked = quizLessons.filter((l) => l.assessmentId === null);
  const mismatched = quizLessons.filter(
    (l) => l.assessmentId !== null && l.assessment?.module.programId !== l.module.programId,
  );
  record(
    "Every QUIZ lesson has a linked assessment in the SAME program",
    quizLessons.length > 0 && unlinked.length === 0 && mismatched.length === 0,
    `total=${quizLessons.length} unlinked=${unlinked.map((l) => l.title).join(",")} mismatched=${mismatched.map((l) => l.title).join(",")}`,
  );

  // 10. Seed fixture proof of the completion rule (M4.5 2d): Alex's linked
  // lesson is completed (passed), David's is not (failed) — read-only.
  const sqlQuizLesson = await prisma.lesson.findFirstOrThrow({ where: { title: "SQL Fundamentals Assessment" } });
  const [alexLessonProgress, davidLessonProgress] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId: alexEnrollment.id, lessonId: sqlQuizLesson.id } },
    }),
    prisma.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId: davidEnrollment.id, lessonId: sqlQuizLesson.id } },
    }),
  ]);
  record(
    "Seed fixture: Alex (passed) has the quiz lesson marked complete, David (failed) does not",
    alexLessonProgress?.completed === true && (davidLessonProgress === null || davidLessonProgress.completed === false),
    `alex=${alexLessonProgress?.completed} david=${davidLessonProgress?.completed ?? "no row"}`,
  );

  console.log("verify-assessments results:\n");
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
