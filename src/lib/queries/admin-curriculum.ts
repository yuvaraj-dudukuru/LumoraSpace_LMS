import "server-only";
import type { AssessmentKind, AssignmentType, ContentStatus, LessonType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** /admin/curriculum — one program's modules, lessons, assessments and
 * assignments, as the builder renders them. ADMIN-only callers. */

export type CurriculumLesson = {
  id: string;
  order: number;
  title: string;
  type: LessonType;
  durationMins: number | null;
  description: string | null;
  videoUrl: string | null;
  bodyContent: string | null;
  /** The linked assessment for a QUIZ lesson. */
  assessment: { id: string; title: string; status: ContentStatus; questionCount: number } | null;
  /** LessonProgress rows of any kind — a lesson learners have touched can't be deleted. */
  progressCount: number;
};

export type CurriculumModule = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  status: ContentStatus;
  estimatedDurationMins: number | null;
  /** Sum of the lessons' durations (lessons without one count 0). */
  lessonMinutes: number;
  lessons: CurriculumLesson[];
  assessments: {
    id: string;
    title: string;
    kind: AssessmentKind;
    status: ContentStatus;
    questionCount: number;
    attemptCount: number;
    /** The QUIZ lesson this assessment is attached to, if any. */
    lessonId: string | null;
  }[];
  assignments: { id: string; title: string; type: AssignmentType; submissionCount: number }[];
};

/** One kind of problem; `items` names each place it occurs (empty for program-level issues). */
export type CurriculumIssue = { id: string; message: string; items: string[] };

export type AdminCurriculum = {
  program: { id: string; name: string; status: ContentStatus; updatedAt: Date };
  modules: CurriculumModule[];
  counts: { modules: number; lessons: number; practiceItems: number; assignments: number; assessments: number };
  totalMinutes: number;
  issues: CurriculumIssue[];
};

/** Pure. The real, checkable problems in a curriculum — each one is something
 * a learner would actually hit. An empty list means none of these were found,
 * not that the content is good. */
export function validateCurriculum(modules: CurriculumModule[]): CurriculumIssue[] {
  const label = (programModule: CurriculumModule) => `Module ${String(programModule.order).padStart(2, "0")}`;

  // One bucket per kind of problem, in the order they're reported.
  const buckets = {
    emptyModule: [] as string[],
    quizUnlinked: [] as string[],
    quizNoQuestions: [] as string[],
    quizUnpublished: [] as string[],
    videoNoUrl: [] as string[],
    readingNoContent: [] as string[],
  };

  for (const programModule of modules) {
    if (programModule.lessons.length === 0) buckets.emptyModule.push(`${label(programModule)} — ${programModule.title}`);
    for (const lesson of programModule.lessons) {
      const where = `${label(programModule)} — ${lesson.title}`;
      if (lesson.type === "QUIZ" && !lesson.assessment) buckets.quizUnlinked.push(where);
      if (lesson.type === "QUIZ" && lesson.assessment) {
        if (lesson.assessment.questionCount === 0) buckets.quizNoQuestions.push(where);
        if (programModule.status === "PUBLISHED" && lesson.assessment.status !== "PUBLISHED") buckets.quizUnpublished.push(where);
      }
      if (lesson.type === "VIDEO" && !lesson.videoUrl) buckets.videoNoUrl.push(where);
      if (lesson.type === "READING" && !lesson.bodyContent) buckets.readingNoContent.push(where);
    }
  }

  const count = (items: string[], one: string, many: string) => `${items.length} ${items.length === 1 ? one : many}`;
  const issues: CurriculumIssue[] = [];

  if (modules.length === 0) {
    issues.push({ id: "no-modules", message: "This program has no modules yet.", items: [] });
  } else if (!modules.some((programModule) => programModule.status === "PUBLISHED")) {
    issues.push({ id: "none-published", message: "No module is published, so learners see an empty curriculum.", items: [] });
  }
  if (buckets.emptyModule.length > 0) {
    issues.push({ id: "empty-module", message: `${count(buckets.emptyModule, "module has", "modules have")} no lessons.`, items: buckets.emptyModule });
  }
  if (buckets.quizUnlinked.length > 0) {
    issues.push({ id: "quiz-unlinked", message: `${count(buckets.quizUnlinked, "quiz lesson has", "quiz lessons have")} no assessment linked.`, items: buckets.quizUnlinked });
  }
  if (buckets.quizNoQuestions.length > 0) {
    issues.push({ id: "quiz-empty", message: `${count(buckets.quizNoQuestions, "quiz links", "quizzes link")} to an assessment with no questions.`, items: buckets.quizNoQuestions });
  }
  if (buckets.quizUnpublished.length > 0) {
    issues.push({ id: "quiz-draft", message: `${count(buckets.quizUnpublished, "published quiz links", "published quizzes link")} to an assessment that isn't published.`, items: buckets.quizUnpublished });
  }
  if (buckets.videoNoUrl.length > 0) {
    issues.push({ id: "video", message: `${count(buckets.videoNoUrl, "video lesson has", "video lessons have")} no video URL.`, items: buckets.videoNoUrl });
  }
  if (buckets.readingNoContent.length > 0) {
    issues.push({ id: "reading", message: `${count(buckets.readingNoContent, "reading lesson has", "reading lessons have")} no content.`, items: buckets.readingNoContent });
  }
  return issues;
}

export async function getCurriculumForAdmin(programId: string): Promise<AdminCurriculum | null> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      modules: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          description: true,
          status: true,
          estimatedDurationMins: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              title: true,
              type: true,
              durationMins: true,
              description: true,
              videoUrl: true,
              bodyContent: true,
              assessment: { select: { id: true, title: true, status: true, _count: { select: { questions: true } } } },
              _count: { select: { progress: true } },
            },
          },
          assessments: {
            orderBy: { title: "asc" },
            select: {
              id: true,
              title: true,
              kind: true,
              status: true,
              lesson: { select: { id: true } },
              _count: { select: { questions: true, attempts: true } },
            },
          },
          assignments: {
            orderBy: { title: "asc" },
            select: { id: true, title: true, type: true, _count: { select: { submissions: true } } },
          },
        },
      },
    },
  });
  if (!program) return null;

  const modules: CurriculumModule[] = program.modules.map((programModule) => ({
    id: programModule.id,
    order: programModule.order,
    title: programModule.title,
    description: programModule.description,
    status: programModule.status,
    estimatedDurationMins: programModule.estimatedDurationMins,
    lessonMinutes: programModule.lessons.reduce((sum, lesson) => sum + (lesson.durationMins ?? 0), 0),
    lessons: programModule.lessons.map((lesson) => ({
      id: lesson.id,
      order: lesson.order,
      title: lesson.title,
      type: lesson.type,
      durationMins: lesson.durationMins,
      description: lesson.description,
      videoUrl: lesson.videoUrl,
      bodyContent: lesson.bodyContent,
      assessment: lesson.assessment
        ? {
            id: lesson.assessment.id,
            title: lesson.assessment.title,
            status: lesson.assessment.status,
            questionCount: lesson.assessment._count.questions,
          }
        : null,
      progressCount: lesson._count.progress,
    })),
    assessments: programModule.assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      kind: assessment.kind,
      status: assessment.status,
      questionCount: assessment._count.questions,
      attemptCount: assessment._count.attempts,
      lessonId: assessment.lesson?.id ?? null,
    })),
    assignments: programModule.assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      type: assignment.type,
      submissionCount: assignment._count.submissions,
    })),
  }));

  const allAssessments = modules.flatMap((programModule) => programModule.assessments);
  return {
    program: { id: program.id, name: program.name, status: program.status, updatedAt: program.updatedAt },
    modules,
    counts: {
      modules: modules.length,
      lessons: modules.reduce((sum, programModule) => sum + programModule.lessons.length, 0),
      practiceItems: allAssessments.filter((assessment) => assessment.kind === "PRACTICE").length,
      assignments: modules.reduce((sum, programModule) => sum + programModule.assignments.length, 0),
      assessments: allAssessments.filter((assessment) => assessment.kind === "GRADED").length,
    },
    totalMinutes: modules.reduce((sum, programModule) => sum + programModule.lessonMinutes, 0),
    issues: validateCurriculum(modules),
  };
}

/** "4h 30m" / "45m" / "0m". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
