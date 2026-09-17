// Exercises prisma/bootstrap-schema.ts's validateBootstrapData() — the pure,
// pre-DB validator both bootstrap scripts run first — against three
// deliberately broken fixtures (each derived from the real file so the only
// thing wrong is what the fixture breaks) and then against the real
// prisma/bootstrap-data.json itself. No database, no env vars.
// Run: npx tsx scripts/verify-bootstrap-data.ts
import { readFileSync } from "fs";
import { join } from "path";
import { validateBootstrapData, isTemplateData } from "../prisma/bootstrap-schema";

type Check = { name: string; pass: boolean; detail?: string };

// Loosely-typed, deliberately: the fixtures need to write garbage (a string
// where a number goes, an unknown lesson id) that the real type forbids.
type Json = Record<string, unknown>;

function loadReal(): Json {
  return JSON.parse(readFileSync(join(__dirname, "..", "prisma", "bootstrap-data.json"), "utf-8")) as Json;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Path helper for fixtures: get programs[0] as a loosely-typed object. */
function firstProgram(data: Json): Json {
  const programs = data.programs as Json[];
  return programs[0];
}

function expectFailure(name: string, data: unknown, mustMention: string[]): Check {
  const result = validateBootstrapData(data);
  if (result.success) return { name, pass: false, detail: "validator accepted a broken file" };
  const missing = mustMention.filter((needle) => !result.issues.some((issue) => issue.includes(needle)));
  return {
    name,
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? `${result.issues.length} issue(s): ${result.issues.map((i) => i.split(": ").slice(1).join(": ")).join(" | ")}`
        : `issues did not mention: ${missing.join(", ")} — got: ${result.issues.join(" | ")}`,
  };
}

function main(): void {
  const checks: Check[] = [];
  const real = loadReal();

  // Fixture 1 — dates: endDate before startDate on one batch, and an
  // assignment dueAt that isn't ISO-8601 at all.
  const brokenDates = clone(real);
  const p1 = firstProgram(brokenDates);
  const batches1 = p1.batches as Json[];
  batches1[0].startDate = "2026-12-01";
  batches1[0].endDate = "2026-10-01";
  const assignments1 = p1.assignments as Json[];
  assignments1[0].dueAt = "next Tuesday";
  checks.push(
    expectFailure("Fixture 1: endDate before startDate + non-ISO dueAt are rejected", brokenDates, [
      "endDate (2026-10-01) must be after startDate (2026-12-01)",
      '"next Tuesday" is not a valid ISO-8601 date',
    ]),
  );

  // Fixture 2 — references: an assessment linked to a READING lesson (not a
  // QUIZ), and an assignment pointing at a moduleOrder that doesn't exist.
  const brokenRefs = clone(real);
  const p2 = firstProgram(brokenRefs);
  const assessments2 = p2.assessments as Json[];
  assessments2[0].linkedLessonId = "m1-l2"; // a READING lesson in the template
  const assignments2 = p2.assignments as Json[];
  assignments2[0].moduleOrder = 99;
  checks.push(
    expectFailure("Fixture 2: linked non-QUIZ lesson + dangling moduleOrder are rejected", brokenRefs, [
      "which is type READING — only a QUIZ lesson can carry an assessment",
      "references moduleOrder 99, which doesn't match any module's order",
      // Side effect of re-pointing the only assessment: the real QUIZ lesson is now orphaned.
      'QUIZ lesson "m1-l3" has no assessment linking to it',
    ]),
  );

  // Fixture 3 — uniqueness + options: duplicate lesson id, duplicate module
  // order, a MULTIPLE_CHOICE question with no correct option, and a
  // TRUE_FALSE question with no options at all.
  const brokenUnique = clone(real);
  const p3 = firstProgram(brokenUnique);
  const modules3 = p3.modules as Json[];
  modules3[1].order = 1; // collides with module 1
  const lessons3 = modules3[1].lessons as Json[];
  lessons3[0].id = "m1-l1"; // collides with module 1's first lesson
  const assessments3 = p3.assessments as Json[];
  const questions3 = assessments3[0].questions as Json[];
  const mcOptions = questions3[0].options as Json[];
  for (const option of mcOptions) option.isCorrect = false;
  questions3[1].options = [];
  checks.push(
    expectFailure("Fixture 3: duplicate module order/lesson id + MC without correct + TF without options are rejected", brokenUnique, [
      "duplicate module order 1",
      'duplicate lesson id "m1-l1"',
      "MULTIPLE_CHOICE question 1 has no correct option",
      "TRUE_FALSE question 2 has no options",
    ]),
  );

  // Positive control: CODE_SNIPPET with no options is fine.
  const codeSnippet = clone(real);
  const p4 = firstProgram(codeSnippet);
  const assessments4 = p4.assessments as Json[];
  const questions4 = assessments4[0].questions as Json[];
  questions4.push({ order: 99, type: "CODE_SNIPPET", text: "Write a SELECT.", points: 5 });
  const codeSnippetResult = validateBootstrapData(codeSnippet);
  checks.push({
    name: "CODE_SNIPPET question with no options is accepted",
    pass: codeSnippetResult.success,
    detail: codeSnippetResult.success ? undefined : codeSnippetResult.issues.join(" | "),
  });

  // The real file must validate, and must still be flagged as the template.
  const realResult = validateBootstrapData(real);
  checks.push({
    name: "Real prisma/bootstrap-data.json validates",
    pass: realResult.success,
    detail: realResult.success
      ? `${realResult.data.programs.length} program(s): ${realResult.data.programs.map((p) => p.program.slug).join(", ")}`
      : realResult.issues.join(" | "),
  });
  checks.push({
    name: 'Real file carries "_template": true (both bootstrap scripts will refuse it as-is)',
    pass: realResult.success && isTemplateData(realResult.data),
  });

  console.log("verify-bootstrap-data results:\n");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? `\n      (${check.detail})` : ""}`);
  }
  const failures = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
  if (failures.length > 0) process.exitCode = 1;
}

main();
