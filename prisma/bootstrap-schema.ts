// Shared between bootstrap.ts (fresh DB: admin + curriculum, guarded on
// User count) and bootstrap-curriculum.ts (an existing DB that already has
// users, guarded per program slug instead) — both need the exact same
// validated shape and the exact same creation logic, so neither script can
// silently drift from the other on what "curriculum" means.
//
// File shape (prisma/bootstrap-data.json):
//   { "_template"?: boolean, "programs": [ { program, modules, assessments,
//     assignments, batches } ] }
// `_template: true` marks the checked-in placeholder content — both scripts
// refuse to load it. Delete that key (and replace the placeholders) before
// a real deploy.
//
// validateBootstrapData() is PURE (no DB, no fs, no process.exit) so it can
// be unit-checked by scripts/verify-bootstrap-data.ts. Every cross-reference
// rule lives in the superRefine below, so a broken file fails BEFORE the
// first DB call, never partway through a transaction.
import { readFileSync } from "fs";
import { join } from "path";
import { AssignmentType, LessonType, type Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

const optionSchema = z.object({
  label: z.string(),
  text: z.string(),
  isCorrect: z.boolean().default(false),
});

const questionSchema = z.object({
  order: z.number().int(),
  type: z.enum(["MULTIPLE_CHOICE", "CODE_SNIPPET", "TRUE_FALSE"]),
  text: z.string(),
  points: z.number().int().positive(),
  explanation: z.string().optional(),
  // Optional for CODE_SNIPPET (never auto-graded — see docs/CONTRACTS.md);
  // MULTIPLE_CHOICE/TRUE_FALSE must have >= 1 option and >= 1 correct one,
  // enforced in the superRefine below where the question type is known.
  options: z.array(optionSchema).default([]),
});

const assessmentSchema = z.object({
  moduleOrder: z.number().int(),
  linkedLessonId: z.string().optional(),
  title: z.string(),
  kind: z.enum(["PRACTICE", "GRADED"]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  timeLimitMins: z.number().int().positive().optional(),
  passingScorePercent: z.number().int().min(0).max(100).optional(),
  allowedAttempts: z.number().int().min(0),
  shuffleQuestions: z.boolean(),
  showResultsImmediately: z.boolean(),
  questions: z.array(questionSchema).min(1),
});

const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["VIDEO", "READING", "QUIZ"]),
  order: z.number().int(),
  durationMins: z.number().int().positive().optional(),
  videoUrl: z.string().url().optional(),
  bodyContent: z.string().optional(),
  description: z.string().optional(),
});

const moduleSchema = z.object({
  title: z.string(),
  order: z.number().int(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  estimatedDurationMins: z.number().int().positive().optional(),
  lessons: z.array(lessonSchema),
});

const rubricCriterionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  maxScore: z.number().int().positive(),
  order: z.number().int(),
});

const assignmentSchema = z.object({
  moduleOrder: z.number().int(),
  title: z.string(),
  type: z.enum(["ASSIGNMENT", "PROJECT"]),
  overview: z.string(),
  requirements: z.array(z.string()),
  instructions: z.array(z.object({ step: z.number().int(), title: z.string(), description: z.string() })),
  estimatedMins: z.number().int().positive().optional(),
  dueAt: z.string().optional(),
  maxAttempts: z.number().int().positive(),
  allowGithubUrl: z.boolean(),
  rubricCriteria: z.array(rubricCriterionSchema).min(1),
});

const batchSchema = z.object({
  name: z.string(),
  code: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"]),
  scheduleNote: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

export const bootstrapProgramSchema = z.object({
  program: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    durationWeeks: z.number().int().positive(),
    format: z.enum(["ONLINE", "HYBRID"]),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    credentialType: z.string().optional(),
  }),
  modules: z.array(moduleSchema).min(1),
  assessments: z.array(assessmentSchema),
  assignments: z.array(assignmentSchema).default([]),
  batches: z.array(batchSchema),
});

export type BootstrapProgram = z.infer<typeof bootstrapProgramSchema>;

/** Strict ISO-8601 date or date-time (e.g. "2026-10-01" or
 * "2026-10-01T09:00:00Z"). `new Date("garbage")` is silently Invalid Date
 * and `new Date("10/1/2026")` silently parses in local time — neither is
 * acceptable for a batch that real learners will be enrolled into. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Every cross-reference and business rule that the flat Zod shape above
 * can't express. Runs per program, entirely in memory, BEFORE any DB call. */
function refineProgram(program: BootstrapProgram, ctx: z.RefinementCtx, base: (string | number)[]): void {
  const issue = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: "custom", path: [...base, ...path], message });
  };

  // Module orders unique; lesson ids unique across the whole program.
  const moduleOrders = new Set<number>();
  const lessonTypeById = new Map<string, BootstrapProgram["modules"][number]["lessons"][number]["type"]>();
  program.modules.forEach((moduleDef, moduleIndex) => {
    if (moduleOrders.has(moduleDef.order)) {
      issue(["modules", moduleIndex, "order"], `duplicate module order ${moduleDef.order}`);
    }
    moduleOrders.add(moduleDef.order);

    moduleDef.lessons.forEach((lessonDef, lessonIndex) => {
      if (lessonTypeById.has(lessonDef.id)) {
        issue(["modules", moduleIndex, "lessons", lessonIndex, "id"], `duplicate lesson id "${lessonDef.id}"`);
      }
      lessonTypeById.set(lessonDef.id, lessonDef.type);
    });
  });

  // Assessments: moduleOrder resolves; linkedLessonId resolves, is a QUIZ,
  // and is linked at most once (Lesson.assessmentId is a unique FK).
  const linkedLessonIds = new Set<string>();
  program.assessments.forEach((assessmentDef, assessmentIndex) => {
    if (!moduleOrders.has(assessmentDef.moduleOrder)) {
      issue(
        ["assessments", assessmentIndex, "moduleOrder"],
        `assessment "${assessmentDef.title}" references moduleOrder ${assessmentDef.moduleOrder}, which doesn't match any module's order`,
      );
    }
    if (assessmentDef.linkedLessonId !== undefined) {
      const lessonType = lessonTypeById.get(assessmentDef.linkedLessonId);
      if (lessonType === undefined) {
        issue(
          ["assessments", assessmentIndex, "linkedLessonId"],
          `assessment "${assessmentDef.title}" references linkedLessonId "${assessmentDef.linkedLessonId}", which doesn't match any lesson's id`,
        );
      } else if (lessonType !== "QUIZ") {
        issue(
          ["assessments", assessmentIndex, "linkedLessonId"],
          `assessment "${assessmentDef.title}" is linked to lesson "${assessmentDef.linkedLessonId}", which is type ${lessonType} — only a QUIZ lesson can carry an assessment`,
        );
      } else if (linkedLessonIds.has(assessmentDef.linkedLessonId)) {
        issue(
          ["assessments", assessmentIndex, "linkedLessonId"],
          `lesson "${assessmentDef.linkedLessonId}" is linked by more than one assessment`,
        );
      }
      linkedLessonIds.add(assessmentDef.linkedLessonId);
    }

    // MULTIPLE_CHOICE / TRUE_FALSE need >= 1 option and >= 1 correct one.
    // CODE_SNIPPET options are optional (never auto-graded).
    assessmentDef.questions.forEach((questionDef, questionIndex) => {
      if (questionDef.type === "CODE_SNIPPET") return;
      const path = ["assessments", assessmentIndex, "questions", questionIndex, "options"];
      if (questionDef.options.length === 0) {
        issue(path, `${questionDef.type} question ${questionDef.order} has no options`);
      } else if (!questionDef.options.some((option) => option.isCorrect)) {
        issue(path, `${questionDef.type} question ${questionDef.order} has no correct option`);
      }
    });
  });

  // Every QUIZ lesson has an assessment — otherwise the lesson page has
  // nothing to render and progress can never reach 100%.
  program.modules.forEach((moduleDef, moduleIndex) => {
    moduleDef.lessons.forEach((lessonDef, lessonIndex) => {
      if (lessonDef.type === "QUIZ" && !linkedLessonIds.has(lessonDef.id)) {
        issue(
          ["modules", moduleIndex, "lessons", lessonIndex],
          `QUIZ lesson "${lessonDef.id}" has no assessment linking to it (add an assessment with linkedLessonId: "${lessonDef.id}")`,
        );
      }
    });
  });

  // Assignments: moduleOrder resolves; dueAt (if any) is a valid ISO date.
  program.assignments.forEach((assignmentDef, assignmentIndex) => {
    if (!moduleOrders.has(assignmentDef.moduleOrder)) {
      issue(
        ["assignments", assignmentIndex, "moduleOrder"],
        `assignment "${assignmentDef.title}" references moduleOrder ${assignmentDef.moduleOrder}, which doesn't match any module's order`,
      );
    }
    if (assignmentDef.dueAt !== undefined && parseIsoDate(assignmentDef.dueAt) === null) {
      issue(["assignments", assignmentIndex, "dueAt"], `"${assignmentDef.dueAt}" is not a valid ISO-8601 date`);
    }
  });

  // Batches: valid ISO dates, endDate strictly after startDate.
  program.batches.forEach((batchDef, batchIndex) => {
    const start = parseIsoDate(batchDef.startDate);
    const end = parseIsoDate(batchDef.endDate);
    if (start === null) {
      issue(["batches", batchIndex, "startDate"], `"${batchDef.startDate}" is not a valid ISO-8601 date`);
    }
    if (end === null) {
      issue(["batches", batchIndex, "endDate"], `"${batchDef.endDate}" is not a valid ISO-8601 date`);
    }
    if (start !== null && end !== null && end.getTime() <= start.getTime()) {
      issue(["batches", batchIndex, "endDate"], `endDate (${batchDef.endDate}) must be after startDate (${batchDef.startDate})`);
    }
  });
}

export const bootstrapDataSchema = z
  .object({
    _template: z.boolean().optional(),
    programs: z.array(bootstrapProgramSchema).min(1, "programs must contain at least one program"),
  })
  .superRefine((data, ctx) => {
    const slugs = new Set<string>();
    data.programs.forEach((programDef, programIndex) => {
      if (slugs.has(programDef.program.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["programs", programIndex, "program", "slug"],
          message: `duplicate program slug "${programDef.program.slug}"`,
        });
      }
      slugs.add(programDef.program.slug);
      refineProgram(programDef, ctx, ["programs", programIndex]);
    });
  });

export type BootstrapData = z.infer<typeof bootstrapDataSchema>;

export type BootstrapValidation =
  | { success: true; data: BootstrapData }
  | { success: false; issues: string[] };

/** Pure: shape + every cross-reference rule, no DB, no fs, no exit. Used by
 * loadBootstrapData() and directly by scripts/verify-bootstrap-data.ts. */
export function validateBootstrapData(raw: unknown): BootstrapValidation {
  const parsed = bootstrapDataSchema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

export function isTemplateData(data: BootstrapData): boolean {
  return data._template === true;
}

export const TEMPLATE_REFUSAL_MESSAGE =
  'Refused: prisma/bootstrap-data.json still has "_template": true — it is the placeholder ' +
  "curriculum that ships with the repo, not your content. Replace the placeholders with real " +
  'programs/lessons/questions, delete the "_template" key, and run again. Nothing was written.';

export function loadBootstrapData(): BootstrapData {
  const path = join(__dirname, "bootstrap-data.json");
  const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
  const result = validateBootstrapData(raw);
  if (!result.success) {
    console.error("prisma/bootstrap-data.json is invalid — nothing was written:");
    for (const issue of result.issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  }
  return result.data;
}

export type CurriculumSummary = {
  programName: string;
  programSlug: string;
  moduleCount: number;
  lessonCount: number;
  assessmentCount: number;
  questionCount: number;
  assignmentCount: number;
  rubricCriterionCount: number;
  batches: { name: string; code: string }[];
};

/** Program -> Module -> Lesson -> Assessment/Question -> Assignment/
 * RubricCriterion -> Batch, in that order (assessments/assignments need
 * their module's real id; a linked QUIZ lesson needs its assessment's real
 * id). Never touches User — callers decide separately whether an admin
 * needs creating. `tx` must be a transaction client so a failure partway
 * through leaves nothing behind. Every cross-reference below was already
 * checked by validateBootstrapData() — the throws that remain are a last
 * line of defence, not the primary check. */
export async function createCurriculum(
  tx: Prisma.TransactionClient | PrismaClient,
  data: BootstrapProgram,
): Promise<CurriculumSummary> {
  const program = await tx.program.create({ data: data.program });

  const moduleIdByOrder = new Map<number, string>();
  const lessonIdByJsonId = new Map<string, string>();
  let lessonCount = 0;

  for (const moduleDef of data.modules) {
    const createdModule = await tx.module.create({
      data: {
        programId: program.id,
        title: moduleDef.title,
        order: moduleDef.order,
        status: moduleDef.status,
        estimatedDurationMins: moduleDef.estimatedDurationMins,
      },
    });
    moduleIdByOrder.set(moduleDef.order, createdModule.id);

    for (const lessonDef of moduleDef.lessons) {
      const lesson = await tx.lesson.create({
        data: {
          moduleId: createdModule.id,
          title: lessonDef.title,
          type: lessonDef.type as LessonType,
          order: lessonDef.order,
          durationMins: lessonDef.durationMins,
          videoUrl: lessonDef.videoUrl,
          bodyContent: lessonDef.bodyContent,
          description: lessonDef.description,
        },
      });
      lessonIdByJsonId.set(lessonDef.id, lesson.id);
      lessonCount++;
    }
  }

  let questionCount = 0;
  for (const assessmentDef of data.assessments) {
    const moduleId = moduleIdByOrder.get(assessmentDef.moduleOrder);
    if (!moduleId) {
      throw new Error(
        `bootstrap-data.json: assessment "${assessmentDef.title}" references moduleOrder ` +
          `${assessmentDef.moduleOrder}, which doesn't match any module's order.`,
      );
    }

    const assessment = await tx.assessment.create({
      data: {
        moduleId,
        title: assessmentDef.title,
        kind: assessmentDef.kind,
        status: assessmentDef.status,
        timeLimitMins: assessmentDef.timeLimitMins,
        passingScorePercent: assessmentDef.passingScorePercent,
        allowedAttempts: assessmentDef.allowedAttempts,
        shuffleQuestions: assessmentDef.shuffleQuestions,
        showResultsImmediately: assessmentDef.showResultsImmediately,
      },
    });

    for (const questionDef of assessmentDef.questions) {
      await tx.question.create({
        data: {
          assessmentId: assessment.id,
          order: questionDef.order,
          type: questionDef.type,
          text: questionDef.text,
          points: questionDef.points,
          explanation: questionDef.explanation,
          options: {
            create: questionDef.options.map((option) => ({
              label: option.label,
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          },
        },
      });
      questionCount++;
    }

    if (assessmentDef.linkedLessonId) {
      const lessonId = lessonIdByJsonId.get(assessmentDef.linkedLessonId);
      if (!lessonId) {
        throw new Error(
          `bootstrap-data.json: assessment "${assessmentDef.title}" references linkedLessonId ` +
            `"${assessmentDef.linkedLessonId}", which doesn't match any lesson's id.`,
        );
      }
      await tx.lesson.update({ where: { id: lessonId }, data: { assessmentId: assessment.id } });
    }
  }

  let rubricCriterionCount = 0;
  for (const assignmentDef of data.assignments) {
    const moduleId = moduleIdByOrder.get(assignmentDef.moduleOrder);
    if (!moduleId) {
      throw new Error(
        `bootstrap-data.json: assignment "${assignmentDef.title}" references moduleOrder ` +
          `${assignmentDef.moduleOrder}, which doesn't match any module's order.`,
      );
    }

    const assignment = await tx.assignment.create({
      data: {
        moduleId,
        title: assignmentDef.title,
        type: assignmentDef.type as AssignmentType,
        overview: assignmentDef.overview,
        requirements: assignmentDef.requirements,
        instructions: assignmentDef.instructions,
        estimatedMins: assignmentDef.estimatedMins,
        dueAt: assignmentDef.dueAt ? new Date(assignmentDef.dueAt) : undefined,
        maxAttempts: assignmentDef.maxAttempts,
        allowGithubUrl: assignmentDef.allowGithubUrl,
      },
    });

    for (const criterionDef of assignmentDef.rubricCriteria) {
      await tx.rubricCriterion.create({
        data: {
          assignmentId: assignment.id,
          name: criterionDef.name,
          description: criterionDef.description,
          maxScore: criterionDef.maxScore,
          order: criterionDef.order,
        },
      });
      rubricCriterionCount++;
    }
  }

  const batches = [];
  for (const batchDef of data.batches) {
    const batch = await tx.batch.create({
      data: {
        programId: program.id,
        name: batchDef.name,
        code: batchDef.code,
        startDate: new Date(batchDef.startDate),
        endDate: new Date(batchDef.endDate),
        status: batchDef.status,
        scheduleNote: batchDef.scheduleNote,
        capacity: batchDef.capacity,
      },
    });
    batches.push(batch);
  }

  return {
    programName: program.name,
    programSlug: program.slug,
    moduleCount: data.modules.length,
    lessonCount,
    assessmentCount: data.assessments.length,
    questionCount,
    assignmentCount: data.assignments.length,
    rubricCriterionCount,
    batches: batches.map((b) => ({ name: b.name, code: b.code })),
  };
}

export function printCurriculumSummary(summary: CurriculumSummary): void {
  console.log(`  Program:        ${summary.programName} (/${summary.programSlug})`);
  console.log(`  Modules:        ${summary.moduleCount}`);
  console.log(`  Lessons:        ${summary.lessonCount}`);
  console.log(`  Assessments:    ${summary.assessmentCount} (${summary.questionCount} questions total)`);
  console.log(`  Assignments:    ${summary.assignmentCount} (${summary.rubricCriterionCount} rubric criteria total)`);
  console.log(`  Batches:        ${summary.batches.map((b) => `${b.code} (${b.name})`).join(", ") || "none"}`);
}

export const BOOTSTRAP_TRANSACTION_TIMEOUT_MS = 120_000;

/** `${APP_URL}/login`, or a literal placeholder when APP_URL isn't set in
 * the shell running the script (it's a runtime var for the app, so it may
 * legitimately be absent here). */
export function loginUrlHint(): string {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return `${appUrl || "<APP_URL>"}/login`;
}
