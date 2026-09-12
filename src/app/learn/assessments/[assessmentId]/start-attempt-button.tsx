"use client"; // needs pending state and a client-side redirect after the Server Action returns an attemptId

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startAttempt } from "./actions";

export function StartAttemptButton({ assessmentId, label }: { assessmentId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await startAttempt(assessmentId);
      if (result.ok) {
        router.push(`/learn/attempts/${result.attemptId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-xs">
      <Button onClick={handleClick} disabled={isPending} size="lg">
        {isPending ? "Starting…" : label}
      </Button>
      {error ? <span className="font-label-sm text-label-sm text-error">{error}</span> : null}
    </div>
  );
}
