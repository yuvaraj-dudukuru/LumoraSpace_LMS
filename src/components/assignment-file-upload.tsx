"use client"; // file input + direct-to-storage upload needs local state and a real DOM File object

import { useRef, useState } from "react";
import { UploadCloud, FileCheck2, X } from "lucide-react";
import { getAssignmentUploadUrl } from "@/app/learn/assignments/actions";
import { ALLOWED_UPLOAD_FILE_TYPES, MAX_UPLOAD_FILE_SIZE_BYTES } from "@/lib/validations/assignment";

const ACCEPT_ATTR = ALLOWED_UPLOAD_FILE_TYPES.join(",");
const MAX_SIZE_LABEL = `${Math.floor(MAX_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024))}MB`;

type UploadState = "idle" | "uploading" | "done" | "error";

export function AssignmentFileUpload({
  assignmentId,
  onUploadComplete,
}: {
  assignmentId: string;
  onUploadComplete: (fileUrl: string | null) => void;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side pre-checks are UX only — getAssignmentUploadUrl re-validates
    // both independently server-side, and the presigned URL itself binds the
    // exact Content-Type/Content-Length S3 will accept (see storage.ts).
    if (!ALLOWED_UPLOAD_FILE_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_FILE_TYPES)[number])) {
      setState("error");
      setError("Unsupported file type. Allowed: PDF, PNG, JPEG, or Word document.");
      return;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      setState("error");
      setError(`File is too large. Maximum size is ${MAX_SIZE_LABEL}.`);
      return;
    }

    setState("uploading");
    setFileName(file.name);

    const result = await getAssignmentUploadUrl(assignmentId, file.name, file.type, file.size);
    if (!result.ok) {
      setState("error");
      setError(result.error);
      onUploadComplete(null);
      return;
    }

    try {
      const response = await fetch(result.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        setState("error");
        setError("Upload failed. Please try again.");
        onUploadComplete(null);
        return;
      }
    } catch {
      setState("error");
      setError("Upload failed. Please check your connection and try again.");
      onUploadComplete(null);
      return;
    }

    setState("done");
    onUploadComplete(result.publicUrl);
  }

  function handleRemove(): void {
    setState("idle");
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onUploadComplete(null);
  }

  return (
    <div className="flex flex-col gap-xs">
      {state === "idle" || state === "error" ? (
        <label className="flex cursor-pointer flex-col items-center gap-sm rounded-lg border border-dashed border-outline-variant p-lg text-center transition-colors hover:bg-surface-container-low">
          <UploadCloud className="h-6 w-6 text-on-surface-variant" />
          <span className="font-label-md text-label-md text-on-surface">Click to upload a file</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            PDF, PNG, JPEG, or Word — up to {MAX_SIZE_LABEL}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="flex items-center justify-between gap-md rounded-lg border border-outline-variant bg-surface-container-low p-md">
          <div className="flex min-w-0 items-center gap-sm">
            {state === "uploading" ? (
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
            ) : (
              <FileCheck2 className="h-4 w-4 shrink-0 text-success" />
            )}
            <span className="truncate font-label-md text-label-md text-on-surface">
              {state === "uploading" ? `Uploading ${fileName}…` : fileName}
            </span>
          </div>
          {state === "done" ? (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove file"
              className="shrink-0 rounded-full p-xs text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
    </div>
  );
}
