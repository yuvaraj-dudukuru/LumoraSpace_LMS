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
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient, LessonType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const prisma = new PrismaClient();

const envSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email("BOOTSTRAP_ADMIN_EMAIL must be a valid email address"),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12, "BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters"),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1, "BOOTSTRAP_ADMIN_NAME is required"),
});

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

const bootstrapDataSchema = z.object({
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

type BootstrapData = z.infer<typeof bootstrapDataSchema>;

function loadBootstrapData(): BootstrapData {
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

async function main(): Promise<void> {
  // 1. Refuse outright if the User table has ANY rows — checked first,
  // before touching env vars or the JSON file, so a misconfigured re-run
  // against a live database exits immediately with no side effects at all.
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    console.error(
      `Bootstrap refused: the User table already has ${existingUserCount} row(s). ` +
        "This script only runs once, against a fresh database. If you need to add " +
        "an admin or curriculum to an existing database, do it through /admin instead.",
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

  const data = loadBootstrapData();

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

      const program = await tx.program.create({ data: data.program });

      // moduleOrder -> real Module.id, and lesson JSON id -> real Lesson.id —
      // both needed below to attach assessments/questions to the right
      // module and to link a QUIZ lesson back to its Assessment.
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
        adminEmail: admin.email,
        programName: program.name,
        programSlug: program.slug,
        moduleCount: data.modules.length,
        lessonCount,
        assessmentCount: data.assessments.length,
        questionCount,
        batches: batches.map((b) => ({ name: b.name, code: b.code })),
      };
    },
    { timeout: 30_000 },
  );

  console.log("Bootstrap complete:\n");
  console.log(`  Admin account:  ${summary.adminEmail}`);
  console.log(`  Program:        ${summary.programName} (/${summary.programSlug})`);
  console.log(`  Modules:        ${summary.moduleCount}`);
  console.log(`  Lessons:        ${summary.lessonCount}`);
  console.log(`  Assessments:    ${summary.assessmentCount} (${summary.questionCount} questions total)`);
  console.log(`  Batches:        ${summary.batches.map((b) => `${b.code} (${b.name})`).join(", ")}`);
  console.log("\nNothing was deleted. This script will refuse to run again while any User row exists.");
}

main()
  .catch((error: unknown) => {
    console.error("Bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
