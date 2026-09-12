import "server-only";
import type { LessonType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Derived only when a QUIZ lesson isn't yet completed — once completed, the
 * existing green-check treatment already means "passed", so no separate
 * badge is shown (see getProgramProgress's mapping below). This sidesteps a
 * retake-after-pass edge case entirely: completion is what's authoritative,
 * this is only ever a status hint for the not-yet-complete cases. */
export type AttemptState = "not_attempted" | "in_progress" | "failed";

export type LessonProgressSummary = {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  durationMins: number | null;
  completed: boolean;
  assessmentId: string | null;
  attemptState: AttemptState | null;
};

export type ModuleProgress = {
  moduleId: string;
  title: string;
  order: number;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  lessons: LessonProgressSummary[];
};

export type ProgramProgress = {
  enrollmentId: string;
  programId: string;
  programName: string;
  overallPercent: number;
  totalLessons: number;
  completedLessons: number;
  modules: ModuleProgress[];
};

function deriveAttemptState(
  assessmentId: string | null,
  completed: boolean,
  assessment: { attempts: { status: string; passed: boolean | null }[] } | null,
): AttemptState | null {
  if (!assessmentId || completed) return null;
  const latest = assessment?.attempts[0];
  if (!latest) return "not_attempted";
  if (latest.status === "IN_PROGRESS") return "in_progress";
  return "failed"; // graded/submitted but still not `completed` => didn't clear the bar
}

/**
 * THE shared progress calculation — every screen that shows a percentage
 * (dashboard, my-learning, curriculum, progress page) calls this. Do not
 * recompute it elsewhere. One query: the enrollment with its program's full
 * module/lesson tree plus this enrollment's completed LessonProgress rows.
 */
export async function getProgramProgress(enrollmentId: string): Promise<ProgramProgress> {
  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: {
      id: true,
      programId: true,
      program: {
        select: {
          name: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              lessons: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  type: true,
                  order: true,
                  durationMins: true,
                  assessmentId: true,
                  // Still one query — this is a bounded, nested select (at
                  // most one QUIZ lesson per module today), not a per-lesson
                  // loop. `enrollmentId` here is the same value already used
                  // as this query's top-level `where`.
                  assessment: {
                    select: {
                      attempts: {
                        where: { enrollmentId },
                        orderBy: { attemptNumber: "desc" },
                        take: 1,
                        select: { status: true, passed: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      lessonProgress: {
        where: { completed: true },
        select: { lessonId: true },
      },
    },
  });

  const completedLessonIds = new Set(enrollment.lessonProgress.map((lp) => lp.lessonId));

  let totalLessons = 0;
  let completedLessons = 0;

  const modules: ModuleProgress[] = enrollment.program.modules.map((programModule) => {
    const lessons: LessonProgressSummary[] = programModule.lessons.map((lesson) => {
      const completed = completedLessonIds.has(lesson.id);
      return {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        order: lesson.order,
        durationMins: lesson.durationMins,
        completed,
        assessmentId: lesson.assessmentId,
        attemptState: deriveAttemptState(lesson.assessmentId, completed, lesson.assessment),
      };
    });

    const moduleCompleted = lessons.filter((lesson) => lesson.completed).length;
    totalLessons += lessons.length;
    completedLessons += moduleCompleted;

    return {
      moduleId: programModule.id,
      title: programModule.title,
      order: programModule.order,
      totalLessons: lessons.length,
      completedLessons: moduleCompleted,
      percent: lessons.length === 0 ? 0 : Math.round((moduleCompleted / lessons.length) * 1000) / 10,
      lessons,
    };
  });

  return {
    enrollmentId: enrollment.id,
    programId: enrollment.programId,
    programName: enrollment.program.name,
    overallPercent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 1000) / 10,
    totalLessons,
    completedLessons,
    modules,
  };
}

/** First lesson (in module/lesson order) that isn't completed yet — derived
 * from an already-fetched ProgramProgress, never a second query. */
export function findNextIncompleteLesson(
  progress: ProgramProgress,
): { moduleId: string; lesson: LessonProgressSummary } | null {
  for (const programModule of progress.modules) {
    const lesson = programModule.lessons.find((item) => !item.completed);
    if (lesson) return { moduleId: programModule.moduleId, lesson };
  }
  return null;
}

/** All lessons in program order, flattened — used to find prev/next siblings
 * on the lesson page without a second full-tree query. */
export function flattenLessons(progress: ProgramProgress): LessonProgressSummary[] {
  return progress.modules.flatMap((programModule) => programModule.lessons);
}
