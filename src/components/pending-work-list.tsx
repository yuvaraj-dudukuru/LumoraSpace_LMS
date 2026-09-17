import Link from "next/link";
import { ClipboardList, FileQuestion, CalendarClock } from "lucide-react";
import { PENDING_WORK_ACTION_LABEL, type PendingWorkItem, type PendingWorkState } from "@/lib/queries/pending-work";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";

const STATE_LABEL: Record<PendingWorkState, string> = {
  not_started: "Not started",
  overdue: "Overdue",
  submitted: "Submitted",
  under_review: "Under review",
  revision_requested: "Revision requested",
  completed: "Completed",
};

// Same colour pairings as curriculum-accordion.tsx's assignment pills.
const STATE_STYLE: Record<PendingWorkState, string> = {
  not_started: "bg-surface-container text-on-surface-variant",
  overdue: "bg-error-container text-on-error-container",
  submitted: "bg-primary-fixed text-primary",
  under_review: "bg-warning-container text-warning",
  revision_requested: "bg-error-container text-on-error-container",
  completed: "bg-success-container text-success",
};

function kindLabel(item: PendingWorkItem): string {
  if (item.kind === "assessment") return "Assessment";
  return item.assignmentType === "PROJECT" ? "Project" : "Assignment";
}

/** Server-safe list of PendingWorkItem rows — shared by /learn (top 3) and
 * /learn/progress (all). Every value shown comes from the item; nothing is
 * invented for a missing due date or estimate. */
export function PendingWorkList({ items, emptyMessage }: { items: PendingWorkItem[]; emptyMessage: string }) {
  if (items.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-sm">
      {items.map((item) => {
        const Icon = item.kind === "assessment" ? FileQuestion : ClipboardList;
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-sm">
              <Icon className="mt-xs h-4 w-4 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-col gap-xs">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
                    {kindLabel(item)}
                  </span>
                  <span className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${STATE_STYLE[item.state]}`}>
                    {STATE_LABEL[item.state]}
                  </span>
                </div>
                <span className="font-label-md text-label-md text-on-surface">{item.title}</span>
                <span className="flex flex-wrap items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                  <span>{item.moduleTitle}</span>
                  <span aria-hidden="true">•</span>
                  <span className="flex items-center gap-xs">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No due date"}
                  </span>
                  {item.estimatedMins !== null ? (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>{item.kind === "assessment" ? `${item.estimatedMins} min limit` : `Est. ${item.estimatedMins} mins`}</span>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
            <Link
              href={item.href}
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit shrink-0" })}
            >
              {PENDING_WORK_ACTION_LABEL[item.action]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
