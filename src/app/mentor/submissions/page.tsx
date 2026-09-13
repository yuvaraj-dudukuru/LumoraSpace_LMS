import Link from "next/link";
import { ClipboardCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getMentorBatchIds, getReviewQueue, type ReviewQueueFilter } from "@/lib/queries/mentor";
import { formatDate } from "@/lib/format";

const TABS: { value: ReviewQueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "In Review" },
  { value: "reviewed", label: "Reviewed" },
  { value: "revision_requested", label: "Revision Requested" },
];

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Pending",
  UNDER_REVIEW: "In Review",
  REVIEWED: "Reviewed",
  REVISION_REQUESTED: "Revision Requested",
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-surface-container text-on-surface-variant",
  UNDER_REVIEW: "bg-warning-container text-warning",
  REVIEWED: "bg-success-container text-success",
  REVISION_REQUESTED: "bg-error-container text-on-error-container",
};

// A submission still awaiting mentor action (pending/in-review) reads as
// urgent once it's been waiting this many days.
const URGENT_AGE_DAYS = 6;

export default async function MentorSubmissionsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireRole("MENTOR", "ADMIN");
  const batchIds = await getMentorBatchIds(user);
  const params = await searchParams;
  const filter: ReviewQueueFilter = TABS.some((tab) => tab.value === params.filter)
    ? (params.filter as ReviewQueueFilter)
    : "all";

  if (batchIds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <ClipboardCheck className="h-12 w-12 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">No Batches Assigned Yet</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          You&apos;re not assigned to any batch right now, so there&apos;s no review queue to show.
        </p>
      </div>
    );
  }

  const queue = await getReviewQueue(batchIds, filter);

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Submissions
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Review learner work and provide feedback, oldest first.
        </p>
      </header>

      <div className="flex flex-wrap gap-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/mentor/submissions" : `/mentor/submissions?filter=${tab.value}`}
            className={`rounded-full px-lg py-sm font-label-md text-label-md transition-colors ${
              filter === tab.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {queue.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">Nothing in this view right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-sm">
          {queue.map((item) => {
            const isActionable = item.status === "SUBMITTED" || item.status === "UNDER_REVIEW";
            const isUrgent = isActionable && item.ageDays !== null && item.ageDays >= URGENT_AGE_DAYS;
            return (
              <li key={item.id}>
                <Link
                  href={`/mentor/submissions/${item.id}`}
                  className={`flex flex-col gap-sm rounded-xl p-lg transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    isUrgent
                      ? "border border-error/30 bg-error-container/20 hover:bg-error-container/30"
                      : "bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-label-md text-label-md text-on-surface">{item.assignmentTitle}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {item.learnerName} · {item.programName} · Attempt {item.attemptNumber}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-md">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {item.submittedAt ? formatDate(item.submittedAt) : "—"}
                    </span>
                    {isUrgent ? (
                      <span className="flex items-center gap-xs font-label-sm text-label-sm text-error">
                        <AlertTriangle className="h-3.5 w-3.5" /> {item.ageDays}d waiting
                      </span>
                    ) : item.ageDays !== null ? (
                      <span className="font-label-sm text-label-sm text-on-surface-variant">{item.ageDays}d</span>
                    ) : null}
                    <span
                      className={`rounded-full px-md py-xs font-label-sm text-label-sm ${STATUS_STYLE[item.status] ?? ""}`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
