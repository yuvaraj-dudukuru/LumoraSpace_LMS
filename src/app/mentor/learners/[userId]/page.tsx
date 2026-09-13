import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowLeft, AlertTriangle, ClipboardCheck, Check, Circle } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getMentorBatchIds, getLearnerDetail, NEEDS_ATTENTION_STALE_DAYS } from "@/lib/queries/mentor";
import { formatDate, formatRelativeTime } from "@/lib/format";

const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  REVISION_REQUESTED: "Revision Requested",
  REVIEWED: "Reviewed",
};

export default async function MentorLearnerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireRole("MENTOR", "ADMIN");
  const batchIds = await getMentorBatchIds(user);

  const learner = await getLearnerDetail(userId, batchIds);
  if (!learner) {
    // getLearnerDetail returns null both when the user doesn't exist and
    // when they're outside every batch this caller can see — forbidden()
    // either way, never distinguishing (don't leak existence).
    forbidden();
  }

  const now = Date.now();
  const daysSinceActive = learner.lastActiveAt
    ? Math.floor((now - learner.lastActiveAt.getTime()) / 86_400_000)
    : null;
  const isStale = daysSinceActive === null || daysSinceActive >= NEEDS_ATTENTION_STALE_DAYS;

  const allSubmissions = learner.enrollments.flatMap((enrollment) =>
    enrollment.submissions.map((submission) => ({ ...submission, programName: enrollment.programName })),
  );
  const pendingReviewSubmissions = allSubmissions.filter(
    (s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW",
  );
  const hasOutstandingRevision = allSubmissions.some((s) => s.status === "REVISION_REQUESTED");
  const hasFailedAttempt = learner.enrollments.some((enrollment) =>
    enrollment.progress.modules.some((programModule) =>
      programModule.lessons.some((lesson) => lesson.attemptState === "failed"),
    ),
  );
  const needsAttention = isStale || hasOutstandingRevision || hasFailedAttempt;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-xl">
      <Link
        href="/mentor/learners"
        className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Learners
      </Link>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <header className="flex items-center gap-md">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline-md text-headline-md text-on-primary-container">
              {learner.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{learner.name}</h1>
              <p className="font-label-md text-label-md text-on-surface-variant">{learner.email}</p>
            </div>
          </header>

          {needsAttention ? (
            <div className="flex items-center gap-sm rounded-xl border border-error/20 bg-error-container/30 p-lg">
              <AlertTriangle className="h-5 w-5 shrink-0 text-error" />
              <p className="font-label-md text-label-md text-on-surface">
                {[
                  isStale
                    ? daysSinceActive === null
                      ? "No recorded activity yet"
                      : `No activity in ${daysSinceActive} days`
                    : null,
                  hasFailedAttempt ? "a failed assessment attempt" : null,
                  hasOutstandingRevision ? "an outstanding revision request" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ) : null}

          {learner.enrollments.map((enrollment) => (
            <section key={enrollment.enrollmentId} className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-md text-headline-md text-on-surface">{enrollment.programName}</h2>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{enrollment.batchName}</span>
              </div>
              <div className="flex flex-col gap-xs">
                <div className="flex items-end justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {enrollment.progress.completedLessons} / {enrollment.progress.totalLessons} lessons completed
                  </span>
                  <span className="font-title-lg text-title-lg text-primary">
                    {enrollment.progress.overallPercent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${enrollment.progress.overallPercent}%` }}
                  />
                </div>
              </div>

              <ul className="flex flex-col gap-xs">
                {enrollment.progress.modules.map((programModule) => {
                  const complete = programModule.percent === 100;
                  return (
                    <li
                      key={programModule.moduleId}
                      className="flex items-center gap-sm rounded-lg bg-surface-container-low px-md py-sm"
                    >
                      {complete ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-on-surface-variant" />
                      )}
                      <span className="flex-1 font-label-md text-label-md text-on-surface">
                        {programModule.title}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {complete ? "Complete" : `${programModule.percent}%`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">
              Pending Work {pendingReviewSubmissions.length > 0 ? `(${pendingReviewSubmissions.length})` : ""}
            </h2>
            {pendingReviewSubmissions.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low p-lg font-body-md text-body-md text-on-surface-variant">
                Nothing awaiting review for this learner.
              </p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {pendingReviewSubmissions.map((submission) => (
                  <li key={submission.id}>
                    <Link
                      href={`/mentor/submissions/${submission.id}`}
                      className="flex items-center justify-between gap-md rounded-xl bg-surface-container-low p-md transition-colors hover:bg-surface-container"
                    >
                      <div>
                        <p className="font-label-md text-label-md text-on-surface">{submission.assignmentTitle}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                          {submission.programName}
                          {submission.submittedAt ? ` · Submitted ${formatRelativeTime(submission.submittedAt)}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
                        {SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-lg text-title-lg text-on-surface">Recent Activity</h2>
            {allSubmissions.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No submission activity yet.</p>
            ) : (
              <ul className="flex flex-col gap-md">
                {allSubmissions
                  .filter((s) => s.submittedAt !== null)
                  .sort((a, b) => (b.submittedAt as Date).getTime() - (a.submittedAt as Date).getTime())
                  .slice(0, 5)
                  .map((submission) => (
                    <li key={submission.id} className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface">
                        Submitted {submission.assignmentTitle} (attempt {submission.attemptNumber})
                      </span>
                      <span className="font-body-md text-sm text-on-surface-variant">
                        {formatRelativeTime(submission.submittedAt as Date)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-lg">
          <div className="rounded-2xl bg-surface-container-low p-lg">
            <div className="flex flex-col gap-md">
              <div>
                <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Last Active</p>
                <p className="font-label-md text-label-md text-on-surface">
                  {learner.lastActiveAt ? formatDate(learner.lastActiveAt) : "No activity yet"}
                </p>
              </div>
              <div>
                <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Pending Tasks</p>
                <p className="font-label-md text-label-md text-on-surface">
                  {pendingReviewSubmissions.length} awaiting review
                </p>
              </div>
              <div>
                <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Status</p>
                <span
                  className={`mt-xs inline-block rounded-full px-md py-xs font-label-sm text-label-sm ${
                    needsAttention
                      ? "bg-error-container text-on-error-container"
                      : "bg-success-container text-success"
                  }`}
                >
                  {needsAttention ? "Needs Attention" : "On Track"}
                </span>
              </div>
            </div>
          </div>

          {pendingReviewSubmissions.length > 0 ? (
            <div className="rounded-2xl bg-surface-container-low p-lg">
              <h3 className="mb-md font-title-lg text-title-lg text-on-surface">Quick Actions</h3>
              <Link
                href={`/mentor/submissions/${pendingReviewSubmissions[0].id}`}
                className="flex items-center gap-sm font-label-md text-label-md text-primary hover:underline"
              >
                <ClipboardCheck className="h-4 w-4" /> Review Assignment
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
