"use client"; // needs a pending transition around the claim Server Action

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { claimForReview } from "./actions";

export function ClaimButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await claimForReview(submissionId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-xs">
      <Button onClick={handleClick} disabled={isPending}>
        {isPending ? "Claiming…" : "Claim for Review"}
      </Button>
      {error ? <span className="font-label-sm text-label-sm text-error">{error}</span> : null}
    </div>
  );
}
