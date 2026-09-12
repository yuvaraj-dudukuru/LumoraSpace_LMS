import { AccessState } from "@prisma/client";
import { requireUser } from "@/lib/auth-guards";
import { getEnrollmentsForUser } from "@/lib/queries/enrollments";
import { getProgramProgress, findNextIncompleteLesson } from "@/lib/queries/progress";
import { MyLearningGrid, type EnrollmentCardData } from "./my-learning-grid";

export default async function MyLearningPage() {
  const user = await requireUser();
  const enrollments = await getEnrollmentsForUser(user.id);

  const cards: EnrollmentCardData[] = await Promise.all(
    enrollments.map(async (enrollment) => {
      if (enrollment.accessState !== AccessState.GRANTED) {
        return {
          enrollmentId: enrollment.id,
          programId: enrollment.programId,
          programName: enrollment.program.name,
          status: enrollment.status,
          accessState: enrollment.accessState,
          overallPercent: 0,
          completedLessons: 0,
          totalLessons: 0,
          currentLessonId: null,
          currentLessonTitle: null,
          currentModuleTitle: null,
        };
      }

      const progress = await getProgramProgress(enrollment.id);
      const next = findNextIncompleteLesson(progress);
      const currentModule = next ? progress.modules.find((m) => m.moduleId === next.moduleId) : undefined;

      return {
        enrollmentId: enrollment.id,
        programId: enrollment.programId,
        programName: enrollment.program.name,
        status: enrollment.status,
        accessState: enrollment.accessState,
        overallPercent: progress.overallPercent,
        completedLessons: progress.completedLessons,
        totalLessons: progress.totalLessons,
        currentLessonId: next?.lesson.id ?? null,
        currentLessonTitle: next?.lesson.title ?? null,
        currentModuleTitle: currentModule?.title ?? null,
      };
    }),
  );

  return (
    <div>
      <div className="mb-xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">My Learning</h1>
        <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
          Continue your courses and keep building your skills.
        </p>
      </div>
      <MyLearningGrid cards={cards} />
    </div>
  );
}
