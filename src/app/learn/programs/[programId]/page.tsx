import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { getProgramProgress, findNextIncompleteLesson } from "@/lib/queries/progress";
import { CurriculumAccordion } from "@/components/curriculum/curriculum-accordion";

export default async function ProgramCurriculumPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const enrollment = await requireGrantedEnrollment(programId);
  const progress = await getProgramProgress(enrollment.id);
  const next = findNextIncompleteLesson(progress);

  const modules = progress.modules.map((programModule) => ({
    id: programModule.moduleId,
    title: programModule.title,
    order: programModule.order,
    percent: programModule.percent,
    lessons: programModule.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      completed: lesson.completed,
      attemptState: lesson.attemptState,
    })),
    assignments: programModule.assignments,
  }));

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface">
          {progress.programName}
        </h1>
        <div className="flex flex-col gap-xs pt-sm">
          <div className="flex items-end justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              Overall Progress
            </span>
            <span className="font-title-lg text-title-lg text-primary">{progress.overallPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.overallPercent}%` }}
            />
          </div>
        </div>
      </header>

      <h2 className="font-headline-md text-headline-md text-on-surface">Curriculum</h2>
      {modules.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          This program&apos;s curriculum hasn&apos;t been published yet.
        </p>
      ) : (
        <CurriculumAccordion modules={modules} mode="learner" defaultOpenModuleId={next?.moduleId} />
      )}
    </div>
  );
}
