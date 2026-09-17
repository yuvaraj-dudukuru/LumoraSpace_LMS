"use client"; // needs form state, a pending transition, and a client-side redirect after submit succeeds

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssignmentFileUpload } from "@/components/assignment-file-upload";
import { submitAssignment } from "./actions";

export function SubmitAssignmentForm({
  assignmentId,
  allowGithubUrl,
  fileUploadEnabled,
}: {
  assignmentId: string;
  allowGithubUrl: boolean;
  /** Decided server-side (isStorageConfigured) — when false the upload
   * control isn't rendered at all, rather than rendering and failing. */
  fileUploadEnabled: boolean;
}) {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitAssignment(assignmentId, {
        githubUrl: githubUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        fileUrl: fileUrl ?? undefined,
      });
      if (result.ok) {
        router.push(`/learn/submissions/${result.submissionId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      {allowGithubUrl ? (
        <div className="flex flex-col gap-xs">
          <Label htmlFor="assignment-github-url">GitHub Repository URL (optional)</Label>
          <Input
            id="assignment-github-url"
            type="url"
            placeholder="https://github.com/you/project"
            value={githubUrl}
            onChange={(event) => setGithubUrl(event.target.value)}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-xs">
        <Label htmlFor="assignment-notes">Notes</Label>
        <textarea
          id="assignment-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={5}
          placeholder="Briefly describe your approach or any challenges faced…"
          className="w-full rounded-lg border border-outline-variant bg-surface p-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* D1 resolved — presigned-upload storage now exists. No per-assignment
          allow flag in the schema (unlike allowGithubUrl); availability is a
          deployment-level fact (all S3_* vars set), decided by the server. */}
      {fileUploadEnabled ? (
        <div className="flex flex-col gap-xs">
          <Label>Attach a file (optional)</Label>
          <AssignmentFileUpload assignmentId={assignmentId} onUploadComplete={setFileUrl} />
        </div>
      ) : null}

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Submitting…" : "Submit Assignment"}
      </Button>
    </form>
  );
}
