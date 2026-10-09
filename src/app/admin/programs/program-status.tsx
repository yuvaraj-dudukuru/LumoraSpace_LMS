import { Pencil } from "lucide-react";
import type { ContentStatus } from "@prisma/client";

const LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Published",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

const PILL_STYLE: Record<ContentStatus, string> = {
  PUBLISHED: "bg-primary-fixed text-primary",
  DRAFT: "bg-secondary-fixed text-secondary",
  ARCHIVED: "bg-surface-container-high text-on-surface-variant",
};

export function ProgramStatusPill({ status }: { status: ContentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-xs whitespace-nowrap rounded-full px-sm py-xs font-label-sm text-label-sm ${PILL_STYLE[status]}`}
    >
      {status === "DRAFT" ? (
        <Pencil className="h-3 w-3" aria-hidden="true" />
      ) : (
        <span
          className={`h-1.5 w-1.5 rounded-full ${status === "PUBLISHED" ? "bg-primary" : "bg-outline"}`}
          aria-hidden="true"
        />
      )}
      {LABEL[status]}
    </span>
  );
}
