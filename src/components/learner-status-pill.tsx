import type { LearnerStatus } from "@/lib/learner-status";

/** One label + colour per LearnerStatus, shared by /learn, /learn/progress
 * and the mentor roster. Colour pairings follow the state pills in
 * curriculum-accordion.tsx so every status pill in the app reads the same. */
export const LEARNER_STATUS_LABEL: Record<LearnerStatus, string> = {
  NOT_STARTED: "Not started",
  ON_TRACK: "On track",
  BEHIND: "Behind",
  COMPLETED: "Completed",
};

const LEARNER_STATUS_STYLE: Record<LearnerStatus, string> = {
  NOT_STARTED: "bg-surface-container text-on-surface-variant",
  ON_TRACK: "bg-success-container text-success",
  BEHIND: "bg-error-container text-on-error-container",
  COMPLETED: "bg-primary-fixed text-primary",
};

export function LearnerStatusPill({ status }: { status: LearnerStatus }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-sm py-xs font-label-sm text-label-sm ${LEARNER_STATUS_STYLE[status]}`}
    >
      {LEARNER_STATUS_LABEL[status]}
    </span>
  );
}
