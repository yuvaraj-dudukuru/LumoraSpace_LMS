"use client"; // needs form state, a pending transition, and a client-side redirect after submit succeeds

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitAssignment } from "./actions";

export function SubmitAssignmentForm({ assignmentId, allowGithubUrl }: { assignmentId: string; allowGithubUrl: boolean }) {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitAssignment(assignmentId, {
        githubUrl: githubUrl.trim() || undefined,
        notes: notes.trim() || undefined,
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

      {/* D1 — no object storage is configured this milestone; a real upload
          input would be a dead control, so this says so instead. */}
      <p className="rounded-lg bg-surface-container-low p-md font-label-sm text-label-sm text-on-surface-variant">
        File upload is coming in a future update — for now, submit a GitHub link and/or notes.
      </p>

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Submitting…" : "Submit Assignment"}
      </Button>
    </form>
  );
}
