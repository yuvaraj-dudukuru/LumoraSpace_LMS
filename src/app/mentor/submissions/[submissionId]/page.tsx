import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2, CheckCircle2, MessageSquare } from "lucide-react";
import { requireMentorForBatch } from "@/lib/auth-guards";
import { getSubmissionForReview } from "@/lib/queries/mentor";
import { getSubmissionFileLink } from "@/lib/submission-file";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { SubmissionFileLink } from "@/components/submission-file-link";
import { ClaimButton } from "./claim-button";
import { RubricScoringForm } from "./rubric-scoring-form";

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  REVISION_REQUESTED: "Revision Requested",
  REVIEWED: "Reviewed",
};

export default async function MentorSubmissionReviewPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  const submission = await getSubmissionForReview(submissionId);
  if (!submission) notFound();

  const mentor = await requireMentorForBatch(submission.batchId);

  // Only after the guard — the presigned GET is minted for this render only.
  const file = await getSubmissionFileLink(submission.fileUrl);
  const hasSubmittedWork = Boolean(submission.githubUrl || submission.notes || file);

  // "Claimable" covers both a fresh SUBMITTED row and a legacy UNDER_REVIEW
  // row with no tracked Review owner (see actions.ts's claimForReview).
  const isClaimable = submission.status === "SUBMITTED" || (submission.status === "UNDER_REVIEW" && !submission.review);
  const isOwnDraft =
    submission.status === "UNDER_REVIEW" && submission.review !== null && submission.review.mentorId === mentor.id;
  const isSomeoneElsesDraft =
    submission.status === "UNDER_REVIEW" && submission.review !== null && submission.review.mentorId !== mentor.id;
  const isFinalized = submission.status === "REVIEWED" || submission.status === "REVISION_REQUESTED";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-xl">
      <Link
        href="/mentor/submissions"
        className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Submissions
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            {submission.learner.name} · Attempt {submission.attemptNumber}
          </p>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{submission.assignment.title}</h1>
        </div>
        <span className="rounded-full bg-surface-container px-md py-xs font-label-md text-label-md text-on-surface-variant">
          {STATUS_LABEL[submission.status] ?? submission.status}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Requirements</h2>
            <ul className="flex flex-col gap-xs">
              {submission.assignment.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-sm">
                  <CheckCircle2 className="mt-xs h-4 w-4 shrink-0 text-primary" />
                  <span className="font-body-md text-body-md text-on-surface">{requirement}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Submitted Work</h2>
            <div className="flex flex-col gap-sm">
              {submission.githubUrl ? (
                <a
                  href={submission.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-sm rounded-xl bg-surface-container-low p-md hover:bg-surface-container"
                >
                  <Link2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-label-md text-label-md text-primary">{submission.githubUrl}</span>
                </a>
              ) : null}
              {file ? <SubmissionFileLink file={file} /> : null}
              {submission.notes ? (
                <div className="rounded-xl bg-surface-container-low p-md">
                  <p className="mb-xs font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">{submission.notes}</p>
                </div>
              ) : null}
              {!hasSubmittedWork ? (
                <p className="font-body-md text-body-md text-on-surface-variant">No submitted work on file.</p>
              ) : null}
              {submission.submittedAt ? (
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Submitted {formatRelativeTime(submission.submittedAt)} ({formatDate(submission.submittedAt)})
                </p>
              ) : null}
            </div>
          </section>

          {submission.priorSubmissions.length > 0 ? (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-lg text-title-lg text-on-surface">Prior Attempts</h2>
              <ul className="flex flex-col gap-xs">
                {submission.priorSubmissions.map((prior) => (
                  <li
                    key={prior.id}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low px-md py-sm"
                  >
                    <span className="font-label-md text-label-md text-on-surface">Attempt {prior.attemptNumber}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {STATUS_LABEL[prior.status] ?? prior.status}
                      {prior.score !== null ? ` · ${prior.score}/${prior.maxScore}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg lg:col-span-1">
          {isClaimable ? (
            <div className="flex flex-col gap-sm">
              <p className="font-body-md text-body-md text-on-surface-variant">
                Claim this submission to start scoring it — this stops another mentor from grading it at the
                same time.
              </p>
              <ClaimButton submissionId={submission.id} />
            </div>
          ) : isSomeoneElsesDraft ? (
            <div className="flex flex-col items-center gap-sm text-center">
              <MessageSquare className="h-6 w-6 text-on-surface-variant" />
              <p className="font-body-md text-body-md text-on-surface-variant">
                Currently being reviewed by {submission.review?.mentorName}.
              </p>
            </div>
          ) : isOwnDraft ? (
            <RubricScoringForm
              submissionId={submission.id}
              criteria={submission.assignment.rubricCriteria}
              initialScores={submission.review?.rubricScores ?? []}
              initialFeedback={submission.review?.overallFeedback ?? ""}
            />
          ) : isFinalized && submission.review ? (
            <div className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant">Final Score</span>
                <span className="font-headline-md text-headline-md text-primary">
                  {submission.review.score} / {submission.review.maxScore}
                </span>
              </div>
              <div className="flex flex-col gap-xs">
                {submission.assignment.rubricCriteria.map((criterion) => {
                  const score = submission.review?.rubricScores.find((rs) => rs.criterionId === criterion.id);
                  return (
                    <div key={criterion.id} className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">{criterion.name}</span>
                      <span className="font-label-md text-label-md text-on-surface">
                        {score?.score ?? "—"} / {criterion.maxScore}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="mb-xs font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Feedback from {submission.review.mentorName}
                </p>
                <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">
                  {submission.review.overallFeedback}
                </p>
              </div>
              {submission.review.reviewedAt ? (
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Reviewed {formatDate(submission.review.reviewedAt)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant">
              This submission isn&apos;t awaiting review.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
