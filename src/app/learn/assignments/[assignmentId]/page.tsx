import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, CalendarClock, CheckCircle2, FileDown, AlertTriangle } from "lucide-react";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveAssignmentProgram, getAssignmentDetail, canSubmitNewAttempt } from "@/lib/queries/assignments";
import { formatDate } from "@/lib/format";
import { isStorageConfigured } from "@/lib/storage";
import { SubmitAssignmentForm } from "./submit-assignment-form";

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  REVISION_REQUESTED: "Revision Requested",
  REVIEWED: "Reviewed",
};

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const resolved = await resolveAssignmentProgram(assignmentId);
  if (!resolved) notFound();

  const enrollment = await requireGrantedEnrollment(resolved.programId);
  const assignment = await getAssignmentDetail(assignmentId, enrollment.id);
  if (!assignment) notFound();

  const isPastDue = assignment.dueAt !== null && assignment.dueAt.getTime() < Date.now();
  const canSubmit = canSubmitNewAttempt(assignment.submissions, assignment.maxAttempts);
  const latestSubmission = assignment.submissions.at(-1) ?? null;
  // Server-side only — the client never sees the S3_* vars, just this boolean.
  const fileUploadEnabled = isStorageConfigured();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-xl">
      <nav className="flex items-center gap-sm overflow-x-auto whitespace-nowrap font-label-sm text-label-sm text-on-surface-variant">
        <Link href={`/learn/programs/${assignment.programId}`} className="hover:text-primary">
          {assignment.programName}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>{assignment.moduleTitle}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-on-surface">{assignment.title}</span>
      </nav>

      <header className="flex flex-col gap-md">
        <div className="flex items-center gap-sm">
          <span className="rounded-full bg-surface-container px-md py-xs font-label-sm text-label-sm text-on-surface-variant">
            {assignment.type === "PROJECT" ? "Project" : "Assignment"}
          </span>
          {isPastDue ? (
            <span className="flex items-center gap-xs rounded-full bg-error-container px-md py-xs font-label-sm text-label-sm text-on-error-container">
              <AlertTriangle className="h-3.5 w-3.5" /> Past Due
            </span>
          ) : null}
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{assignment.title}</h1>
        <div className="flex flex-wrap items-center gap-lg font-label-md text-label-md text-on-surface-variant">
          {assignment.estimatedMins ? (
            <span className="flex items-center gap-xs">
              <Clock className="h-4 w-4" /> {assignment.estimatedMins} min estimated
            </span>
          ) : null}
          {assignment.dueAt ? (
            <span className="flex items-center gap-xs">
              <CalendarClock className="h-4 w-4" /> Due {formatDate(assignment.dueAt)}
            </span>
          ) : null}
          <span>
            {assignment.submissions.length} / {assignment.maxAttempts} attempts used
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Overview</h2>
            <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface-variant">
              {assignment.overview}
            </p>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Requirements</h2>
            <ul className="flex flex-col gap-sm">
              {assignment.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-sm">
                  <CheckCircle2 className="mt-xs h-4 w-4 shrink-0 text-primary" />
                  <span className="font-body-md text-body-md text-on-surface">{requirement}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Instructions</h2>
            <ol className="flex flex-col gap-md">
              {assignment.instructions.map((instruction) => (
                <li key={instruction.step} className="flex gap-md">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container font-label-md text-label-md text-on-primary-container">
                    {instruction.step}
                  </span>
                  <div>
                    <h3 className="font-label-md text-label-md text-on-surface">{instruction.title}</h3>
                    <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                      {instruction.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {assignment.resources.length > 0 ? (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-lg text-title-lg text-on-surface">Resources</h2>
              <ul className="flex flex-col gap-xs">
                {assignment.resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-sm rounded-lg bg-surface-container-low p-md hover:bg-surface-container"
                    >
                      <FileDown className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-label-md text-label-md text-on-surface">{resource.name}</span>
                      <span className="ml-auto font-label-sm text-label-sm text-on-surface-variant">
                        {resource.fileType}
                        {resource.fileSizeKB ? ` · ${resource.fileSizeKB} KB` : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Rubric</h2>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30">
              {assignment.rubricCriteria.map((criterion, index) => (
                <div
                  key={criterion.id}
                  className={`flex items-start justify-between gap-md p-md ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
                >
                  <div>
                    <h3 className="font-label-md text-label-md text-on-surface">{criterion.name}</h3>
                    {criterion.description ? (
                      <p className="mt-xs font-body-md text-sm text-on-surface-variant">{criterion.description}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-label-md text-label-md text-on-surface-variant">
                    {criterion.maxScore} pts
                  </span>
                </div>
              ))}
            </div>
          </section>

          {assignment.submissions.length > 0 ? (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-lg text-title-lg text-on-surface">Your Submissions</h2>
              <ul className="flex flex-col gap-sm">
                {assignment.submissions.map((submission) => (
                  <li key={submission.id}>
                    <Link
                      href={`/learn/submissions/${submission.id}`}
                      className="flex items-center justify-between gap-md rounded-xl bg-surface-container-low p-md hover:bg-surface-container"
                    >
                      <div>
                        <p className="font-label-md text-label-md text-on-surface">
                          Attempt {submission.attemptNumber}
                        </p>
                        {submission.submittedAt ? (
                          <p className="font-label-sm text-label-sm text-on-surface-variant">
                            Submitted {formatDate(submission.submittedAt)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-sm">
                        {submission.review?.score !== null && submission.review?.score !== undefined ? (
                          <span className="font-label-md text-label-md text-on-surface">
                            {submission.review.score} / {submission.review.maxScore}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
                          {STATUS_LABEL[submission.status] ?? submission.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-lg rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg">
            <h2 className="mb-md font-title-lg text-title-lg text-on-surface">Submit Your Work</h2>
            {canSubmit ? (
              <SubmitAssignmentForm
                assignmentId={assignmentId}
                allowGithubUrl={assignment.allowGithubUrl}
                fileUploadEnabled={fileUploadEnabled}
              />
            ) : (
              <div className="flex flex-col gap-sm">
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {latestSubmission?.status === "SUBMITTED" || latestSubmission?.status === "UNDER_REVIEW"
                    ? "Your submission is awaiting review."
                    : "You've used all your allowed attempts for this assignment."}
                </p>
                {latestSubmission ? (
                  <Link
                    href={`/learn/submissions/${latestSubmission.id}`}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    View your latest submission →
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
