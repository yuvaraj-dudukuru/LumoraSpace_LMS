import { notFound } from "next/navigation";
import { Clock, HelpCircle, RotateCcw, AlertCircle } from "lucide-react";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveAssessmentProgram, getAssessmentOverview } from "@/lib/queries/assessments";
import { StartAttemptButton } from "./start-attempt-button";

export default async function AssessmentOverviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  const resolved = await resolveAssessmentProgram(assessmentId);
  if (!resolved) notFound();

  const enrollment = await requireGrantedEnrollment(resolved.programId);
  const overview = await getAssessmentOverview(assessmentId, enrollment.id);
  if (!overview) notFound();

  const isUnlimited = overview.allowedAttempts === 0;
  const attemptsExhausted = !isUnlimited && overview.finishedAttemptCount >= overview.allowedAttempts;
  const canStart = overview.inProgressAttemptId !== null || !attemptsExhausted;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-xl py-3xl text-center">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{overview.title}</h1>

      <dl className="grid w-full grid-cols-1 gap-md sm:grid-cols-3">
        <div className="flex flex-col items-center gap-xs rounded-xl bg-surface-container-low p-lg">
          <Clock className="h-6 w-6 text-primary" />
          <dt className="font-label-sm text-label-sm text-on-surface-variant">Time Limit</dt>
          <dd className="font-title-lg text-title-lg text-on-surface">
            {overview.timeLimitMins ? `${overview.timeLimitMins} min` : "No limit"}
          </dd>
        </div>
        <div className="flex flex-col items-center gap-xs rounded-xl bg-surface-container-low p-lg">
          <HelpCircle className="h-6 w-6 text-primary" />
          <dt className="font-label-sm text-label-sm text-on-surface-variant">Questions</dt>
          <dd className="font-title-lg text-title-lg text-on-surface">{overview.questionCount}</dd>
        </div>
        <div className="flex flex-col items-center gap-xs rounded-xl bg-surface-container-low p-lg">
          <RotateCcw className="h-6 w-6 text-primary" />
          <dt className="font-label-sm text-label-sm text-on-surface-variant">Attempts</dt>
          <dd className="font-title-lg text-title-lg text-on-surface">
            {isUnlimited ? `${overview.finishedAttemptCount} taken` : `${overview.finishedAttemptCount} / ${overview.allowedAttempts}`}
          </dd>
        </div>
      </dl>

      {overview.passingScorePercent !== null ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Passing score: {overview.passingScorePercent}%
        </p>
      ) : null}

      {canStart ? (
        <StartAttemptButton
          assessmentId={assessmentId}
          label={overview.inProgressAttemptId ? "Resume Attempt" : "Start Assessment"}
        />
      ) : (
        <div className="flex flex-col items-center gap-sm rounded-xl bg-error-container p-lg text-on-error-container">
          <AlertCircle className="h-6 w-6" />
          <p className="font-label-md text-label-md">No attempts remaining for this assessment.</p>
        </div>
      )}
    </div>
  );
}
