import "server-only";
import type { LessonType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Cheap lookup used by page guards to resolve which program a lesson
 * belongs to, before requireGrantedEnrollment can run. */
export async function resolveLessonProgram(
  lessonId: string,
): Promise<{ programId: string; moduleId: string } | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { moduleId: true, module: { select: { programId: true } } },
  });
  if (!lesson) return null;
  return { programId: lesson.module.programId, moduleId: lesson.moduleId };
}

export type LessonDetail = {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  durationMins: number | null;
  videoUrl: string | null;
  bodyContent: string | null;
  description: string | null;
  moduleId: string;
  moduleTitle: string;
  programId: string;
  programName: string;
  programSlug: string;
  notes: string | null;
  completed: boolean;
  assessmentId: string | null;
};

/** Full lesson content plus this enrollment's notes/completion, if any. Call
 * only after a guard has already produced a granted `enrollmentId`. */
export async function getLessonDetail(lessonId: string, enrollmentId: string): Promise<LessonDetail | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      type: true,
      order: true,
      durationMins: true,
      videoUrl: true,
      bodyContent: true,
      description: true,
      moduleId: true,
      assessmentId: true,
      module: {
        select: {
          title: true,
          programId: true,
          program: { select: { name: true, slug: true } },
        },
      },
      progress: {
        where: { enrollmentId },
        select: { notes: true, completed: true },
        take: 1,
      },
    },
  });
  if (!lesson) return null;

  const progressRow = lesson.progress[0];
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    order: lesson.order,
    durationMins: lesson.durationMins,
    videoUrl: lesson.videoUrl,
    bodyContent: lesson.bodyContent,
    description: lesson.description,
    moduleId: lesson.moduleId,
    moduleTitle: lesson.module.title,
    programId: lesson.module.programId,
    programName: lesson.module.program.name,
    programSlug: lesson.module.program.slug,
    notes: progressRow?.notes ?? null,
    completed: progressRow?.completed ?? false,
    assessmentId: lesson.assessmentId,
  };
}
