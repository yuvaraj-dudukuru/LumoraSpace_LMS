// Shared between bootstrap.ts (fresh DB: admin + curriculum, guarded on
// User count) and bootstrap-curriculum.ts (an existing DB that already has
// users but no curriculum yet, guarded on Program count instead) — both
// need the exact same validated shape and the exact same creation logic, so
// neither script can silently drift from the other on what "curriculum"
// means.
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
  options: z.array(optionSchema).min(1),
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

export const bootstrapDataSchema = z.object({
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
  batches: z.array(
    z.object({
      name: z.string(),
      code: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"]),
      scheduleNote: z.string().optional(),
      capacity: z.number().int().positive().optional(),
    }),
  ),
});

export type BootstrapData = z.infer<typeof bootstrapDataSchema>;

export function loadBootstrapData(): BootstrapData {
  const path = join(__dirname, "bootstrap-data.json");
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  const parsed = bootstrapDataSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("prisma/bootstrap-data.json is invalid:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
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
 * through (e.g. a bad moduleOrder reference) leaves nothing behind. */
export async function createCurriculum(
  tx: Prisma.TransactionClient | PrismaClient,
  data: BootstrapData,
): Promise<CurriculumSummary> {
  const program = await tx.program.create({ data: data.program });

  const moduleIdByOrder = new Map<number, string>();
  const lessonIdByJsonId = new Map<string, string>();
  let lessonCount = 0;

  for (const moduleDef of data.modules) {
    const module = await tx.module.create({
      data: {
        programId: program.id,
        title: moduleDef.title,
        order: moduleDef.order,
        status: moduleDef.status,
        estimatedDurationMins: moduleDef.estimatedDurationMins,
      },
    });
    moduleIdByOrder.set(moduleDef.order, module.id);

    for (const lessonDef of moduleDef.lessons) {
      const lesson = await tx.lesson.create({
        data: {
          moduleId: module.id,
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
