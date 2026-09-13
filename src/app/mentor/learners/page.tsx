import Link from "next/link";
import { Users, Search, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getMentorBatchIds, getMentorLearners } from "@/lib/queries/mentor";
import { formatRelativeTime } from "@/lib/format";

export default async function MentorLearnersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const user = await requireRole("MENTOR", "ADMIN");
  const batchIds = await getMentorBatchIds(user);
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const status = params.status === "needs_attention" ? "needs_attention" : "all";

  if (batchIds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <Users className="h-12 w-12 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">No Batches Assigned Yet</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          You&apos;re not assigned to any batch right now, so there&apos;s no roster to show.
        </p>
      </div>
    );
  }

  const learners = await getMentorLearners(batchIds, { search, status });

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Learners
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          View learner progress and provide support where it&apos;s needed.
        </p>
      </header>

      <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-sm">
          <Link
            href="/mentor/learners"
            className={`rounded-full px-lg py-sm font-label-md text-label-md transition-colors ${
              status === "all"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            All
          </Link>
          <Link
            href="/mentor/learners?status=needs_attention"
            className={`rounded-full px-lg py-sm font-label-md text-label-md transition-colors ${
              status === "needs_attention"
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Needs Attention
          </Link>
        </div>

        <form method="GET" action="/mentor/learners" className="flex items-center gap-sm">
          {status === "needs_attention" ? <input type="hidden" name="status" value="needs_attention" /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search learners..."
              className="w-full rounded-lg border border-outline-variant bg-surface py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-64"
            />
          </div>
        </form>
      </div>

      {learners.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {search
              ? `No learners match "${search}".`
              : status === "needs_attention"
                ? "No learners need attention right now."
                : "No learners in your batches yet."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-sm">
          {learners.map((learner) => (
            <li key={learner.userId}>
              <Link
                href={`/mentor/learners/${learner.userId}`}
                className="flex flex-col gap-md rounded-xl bg-surface-container-low p-lg transition-colors hover:bg-surface-container sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-md">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container font-label-md text-label-md text-on-primary-container">
                    {learner.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-label-md text-label-md text-on-surface">{learner.name}</p>
                    <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{learner.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-lg sm:gap-xl">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {learner.programName}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{learner.batchName}</span>
                  </div>
                  <div className="flex w-28 flex-col gap-xs">
                    <span className="font-label-md text-label-md text-on-surface">
                      {learner.progressPercent}%
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${learner.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {learner.lastActiveAt ? formatRelativeTime(learner.lastActiveAt) : "No activity yet"}
                  </span>
                  {learner.needsAttention ? (
                    <span className="rounded-full bg-error-container px-md py-xs font-label-sm text-label-sm text-on-error-container">
                      Needs Attention
                    </span>
                  ) : (
                    <span className="rounded-full bg-success-container px-md py-xs font-label-sm text-label-sm text-success">
                      On Track
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
