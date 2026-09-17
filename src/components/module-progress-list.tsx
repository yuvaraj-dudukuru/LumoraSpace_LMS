import type { ModuleProgress } from "@/lib/queries/progress";

type ModuleState = "completed" | "in_progress" | "not_started";

/** Completed = every lesson done (and there is at least one); in progress =
 * some done; otherwise not started. Everything comes from getProgramProgress. */
function moduleState(programModule: ModuleProgress): ModuleState {
  if (programModule.totalLessons > 0 && programModule.percent === 100) return "completed";
  if (programModule.completedLessons > 0) return "in_progress";
  return "not_started";
}

const MODULE_STATE_LABEL: Record<ModuleState, string> = {
  completed: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
};

// Same pairings as the attempt-state pills in curriculum-accordion.tsx.
const MODULE_STATE_STYLE: Record<ModuleState, string> = {
  completed: "bg-success-container text-success",
  in_progress: "bg-warning-container text-warning",
  not_started: "bg-surface-container text-on-surface-variant",
};

/** Server-safe per-module rows for /learn/progress. */
export function ModuleProgressList({ modules }: { modules: ModuleProgress[] }) {
  if (modules.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">No modules in this program yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-sm">
      {modules.map((programModule) => {
        const state = moduleState(programModule);
        return (
          <li key={programModule.moduleId} className="flex flex-col gap-xs">
            <div className="flex flex-wrap items-center justify-between gap-xs">
              <span className="min-w-0 font-label-md text-label-md text-on-surface">{programModule.title}</span>
              <div className="flex shrink-0 items-center gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {programModule.completedLessons} of {programModule.totalLessons} lessons
                </span>
                <span className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${MODULE_STATE_STYLE[state]}`}>
                  {MODULE_STATE_LABEL[state]}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary" style={{ width: `${programModule.percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
