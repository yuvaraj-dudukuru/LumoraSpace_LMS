import Link from "next/link";
import { notFound, forbidden } from "next/navigation";
import { ArrowLeft, Link2, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getSubmissionWithReview } from "@/lib/queries/assignments";
import { getSubmissionFileLink } from "@/lib/submission-file";
import { formatDate } from "@/lib/format";
import { SubmissionFileLink } from "@/components/submission-file-link";

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  REVISION_REQUESTED: "Revision Requested",
  REVIEWED: "Reviewed",
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-surface-container text-on-surface-variant",
  UNDER_REVIEW: "bg-warning-container text-warning",
  REVISION_REQUESTED: "bg-error-container text-on-error-container",
  REVIEWED: "bg-success-container text-success",
};

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const user = await requireUser();

  const submission = await getSubmissionWithReview(submissionId);
  // NOT_STARTED is a seed placeholder, not a real submission (see
  // queries/assignments.ts) — nothing to show, so this reads as not-found
  // rather than rendering a status this page has no copy for.
  if (!submission || submission.status === "NOT_STARTED") notFound();
  if (submission.userId !== user.id) forbidden();

  // Only after the ownership check — the presigned GET is minted for this render only.
  const file = await getSubmissionFileLink(submission.fileUrl);
  const hasSubmittedWork = Boolean(submission.githubUrl || submission.notes || file);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-xl">
      <Link
        href={`/learn/assignments/${submission.assignmentId}`}
        className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Assignment
      </Link>

      <header className="flex items-center justify-between gap-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{submission.assignmentTitle}</h1>
          <p className="font-label-md text-label-md text-on-surface-variant">Attempt {submission.attemptNumber}</p>
        </div>
        <span className={`rounded-full px-md py-xs font-label-md text-label-md ${STATUS_STYLE[submission.status]}`}>
          {STATUS_LABEL[submission.status] ?? submission.status}
        </span>
      </header>

      {submission.review ? (
        <>
          <div className="flex flex-col items-center gap-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-xl text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/30 font-display-lg text-display-lg text-primary">
              {submission.review.score ?? "—"}
            </span>
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
              Final Score {submission.review.maxScore !== null ? `/ ${submission.review.maxScore}` : ""}
            </p>
            {submission.review.reviewedAt ? (
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Reviewed {formatDate(submission.review.reviewedAt)}
              </p>
            ) : null}
          </div>

          <section className="flex flex-col gap-sm rounded-2xl border-l-4 border-primary bg-surface-container-low p-lg">
            <div className="flex items-center gap-sm font-label-md text-label-md text-on-surface-variant">
              <MessageSquare className="h-4 w-4" /> Reviewed by {submission.review.mentorName}
            </div>
            <p className="font-body-md text-body-md text-on-surface">{submission.review.overallFeedback}</p>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Evaluation Breakdown</h2>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30">
              {submission.review.rubricScores.map((rubricScore, index) => (
                <div
                  key={rubricScore.criterionId}
                  className={`flex items-center justify-between gap-md p-md ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
                >
                  <span className="font-label-md text-label-md text-on-surface">{rubricScore.criterionName}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {rubricScore.score} / {rubricScore.maxScore}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-md border-t border-outline-variant/30 bg-surface-container p-md">
                <span className="font-label-md text-label-md text-on-surface">Total Score</span>
                <span className="font-title-lg text-title-lg text-primary">
                  {submission.review.score} / {submission.review.maxScore}
                </span>
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-2xl bg-surface-container-low p-lg font-body-md text-body-md text-on-surface-variant">
          {submission.status === "UNDER_REVIEW"
            ? "A mentor is reviewing your submission — feedback will appear here once it's ready."
            : "This submission hasn't been reviewed yet."}
        </p>
      )}

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
        </div>
      </section>
    </div>
  );
}
