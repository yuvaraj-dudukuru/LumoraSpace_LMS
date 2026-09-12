"use client"; // needs pending/optimistic state around a direct Server Action call

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLessonComplete } from "./actions";

export function MarkCompleteButton({
  lessonId,
  initiallyCompleted,
}: {
  lessonId: string;
  initiallyCompleted: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await markLessonComplete(lessonId);
      if (result.ok) {
        setCompleted(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-xs">
      <Button onClick={handleClick} disabled={isPending || completed} variant={completed ? "secondary" : "default"}>
        {completed ? (
          <>
            <Check className="h-4 w-4" /> Completed
          </>
        ) : isPending ? (
          "Saving…"
        ) : (
          "Mark as Complete"
        )}
      </Button>
      {error ? <span className="font-label-sm text-label-sm text-error">{error}</span> : null}
    </div>
  );
}
