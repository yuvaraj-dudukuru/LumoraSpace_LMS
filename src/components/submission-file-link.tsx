import { FileDown, FileWarning } from "lucide-react";
import type { SubmissionFileLink as SubmissionFileLinkData } from "@/lib/submission-file";

/** Renders the outcome of getSubmissionFileLink. Server-safe (no state) —
 * used by both the mentor grading page and the learner's own submission
 * page so a file-only submission looks the same in both places. */
export function SubmissionFileLink({ file }: { file: SubmissionFileLinkData }) {
  if (file.kind === "unavailable") {
    return (
      <div className="flex items-center gap-sm rounded-xl bg-surface-container-low p-md">
        <FileWarning className="h-4 w-4 shrink-0 text-on-surface-variant" />
        <div className="min-w-0">
          <p className="truncate font-label-md text-label-md text-on-surface">{file.fileName}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            File is attached but can&apos;t be downloaded right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <a
      href={file.href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-sm rounded-xl bg-surface-container-low p-md hover:bg-surface-container"
    >
      <FileDown className="h-4 w-4 shrink-0 text-primary" />
      <span className="font-label-md text-label-md text-primary">View file</span>
      <span className="ml-auto truncate font-label-sm text-label-sm text-on-surface-variant">{file.fileName}</span>
    </a>
  );
}
