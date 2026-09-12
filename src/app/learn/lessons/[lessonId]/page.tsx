import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Check, PlayCircle, FileText, FileQuestion, Clock } from "lucide-react";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveLessonProgram, getLessonDetail } from "@/lib/queries/lessons";
import { getProgramProgress, flattenLessons } from "@/lib/queries/progress";
import { getAssessmentOverview, type AssessmentOverview } from "@/lib/queries/assessments";
import { MarkCompleteButton } from "./mark-complete-button";
import { NotesPanel } from "./notes-panel";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  const resolved = await resolveLessonProgram(lessonId);
  if (!resolved) notFound();

  const enrollment = await requireGrantedEnrollment(resolved.programId);

  const [lesson, progress] = await Promise.all([
    getLessonDetail(lessonId, enrollment.id),
    getProgramProgress(enrollment.id),
  ]);
  if (!lesson) notFound();

  const assessmentOverview = lesson.assessmentId
    ? await getAssessmentOverview(lesson.assessmentId, enrollment.id)
    : null;

  const orderedLessons = flattenLessons(progress);
  const currentIndex = orderedLessons.findIndex((item) => item.id === lessonId);
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null;

  return (
    <div className="flex flex-col gap-xl xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-xl">
        <nav className="flex items-center gap-sm overflow-x-auto whitespace-nowrap font-label-sm text-label-sm text-on-surface-variant">
          <Link href={`/learn/programs/${lesson.programId}`} className="hover:text-primary">
            {lesson.programName}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{lesson.moduleTitle}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-on-surface">{lesson.title}</span>
        </nav>

        <LessonContent lesson={lesson} assessmentOverview={assessmentOverview} />

        <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">
              {lesson.moduleTitle}
            </span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{lesson.title}</h1>
            {lesson.durationMins ? (
              <span className="font-label-md text-label-md text-on-surface-variant">
                {lesson.durationMins} mins
              </span>
            ) : null}
          </div>
          {lesson.type !== "QUIZ" ? (
            <MarkCompleteButton lessonId={lessonId} initiallyCompleted={lesson.completed} />
          ) : null}
        </div>

        {lesson.description ? (
          <p className="font-body-md text-body-md text-on-surface-variant">{lesson.description}</p>
        ) : null}

        <NotesPanel lessonId={lessonId} initialNotes={lesson.notes} />

        <div className="flex items-center justify-between border-t border-outline-variant/30 pt-lg">
          {prevLesson ? (
            <Link href={`/learn/lessons/${prevLesson.id}`} className="font-label-md text-label-md text-primary">
              ← {prevLesson.title}
            </Link>
          ) : (
            <span />
          )}
          {nextLesson ? (
            <Link href={`/learn/lessons/${nextLesson.id}`} className="font-label-md text-label-md text-primary">
              {nextLesson.title} →
            </Link>
          ) : null}
        </div>
      </div>

      <aside className="w-full shrink-0 xl:w-80">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg">
          <p className="mb-md font-label-sm text-label-sm text-on-surface-variant">
            {progress.completedLessons} / {progress.totalLessons} lessons completed
          </p>
          <ul className="flex flex-col gap-xs">
            {orderedLessons.map((item) => {
              const Icon = item.type === "VIDEO" ? PlayCircle : item.type === "READING" ? FileText : FileQuestion;
              const isActive = item.id === lessonId;
              return (
                <li key={item.id}>
                  <Link
                    href={`/learn/lessons/${item.id}`}
                    className={`flex items-center gap-sm rounded-lg px-md py-sm font-label-md text-label-md transition-colors ${
                      isActive
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                  >
                    {item.completed ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <Icon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function LessonContent({
  lesson,
  assessmentOverview,
}: {
  lesson: Awaited<ReturnType<typeof getLessonDetail>>;
  assessmentOverview: AssessmentOverview | null;
}) {
  if (!lesson) return null;

  if (lesson.type === "VIDEO") {
    if (!lesson.videoUrl) {
      return (
        <div className="flex aspect-video items-center justify-center rounded-2xl bg-inverse-surface">
          <p className="font-body-md text-body-md text-inverse-on-surface/70">
            Video content isn&apos;t available for this lesson yet.
          </p>
        </div>
      );
    }
    return (
      <div className="aspect-video overflow-hidden rounded-2xl bg-inverse-surface">
        <video controls className="h-full w-full" src={lesson.videoUrl} />
      </div>
    );
  }

  if (lesson.type === "READING") {
    return (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface p-xl">
        {lesson.bodyContent ? (
          <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">{lesson.bodyContent}</p>
        ) : (
          <p className="font-body-md text-body-md text-on-surface-variant">
            This lesson&apos;s reading content isn&apos;t available yet.
          </p>
        )}
      </div>
    );
  }

  // QUIZ — schema-legal for a QUIZ lesson to have no linked assessment
  // (Lesson.assessmentId is nullable), even though the seed avoids it.
  if (!assessmentOverview) {
    return (
      <div className="flex flex-col items-center gap-md rounded-2xl border border-outline-variant/30 bg-surface p-xl text-center">
        <FileQuestion className="h-8 w-8 text-primary" />
        <p className="font-body-md text-body-md text-on-surface-variant">
          This lesson is a quiz, but it isn&apos;t linked to an assessment yet.
        </p>
      </div>
    );
  }

  const ctaLabel = assessmentOverview.inProgressAttemptId
    ? "Resume Assessment"
    : assessmentOverview.finishedAttemptCount > 0
      ? "View Assessment"
      : "Start Assessment";

  return (
    <div className="flex flex-col items-center gap-lg rounded-2xl border border-outline-variant/30 bg-surface p-xl text-center">
      <FileQuestion className="h-8 w-8 text-primary" />
      <h3 className="font-title-lg text-title-lg text-on-surface">{assessmentOverview.title}</h3>
      <div className="flex flex-wrap items-center justify-center gap-lg font-label-md text-label-md text-on-surface-variant">
        <span className="flex items-center gap-xs">
          <Clock className="h-4 w-4" />
          {assessmentOverview.timeLimitMins ? `${assessmentOverview.timeLimitMins} min` : "No time limit"}
        </span>
        <span>{assessmentOverview.questionCount} questions</span>
        <span>
          {assessmentOverview.allowedAttempts === 0
            ? `${assessmentOverview.finishedAttemptCount} attempts taken`
            : `${assessmentOverview.finishedAttemptCount} / ${assessmentOverview.allowedAttempts} attempts used`}
        </span>
      </div>
      <Link
        href={`/learn/assessments/${assessmentOverview.id}`}
        className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
