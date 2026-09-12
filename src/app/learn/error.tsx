"use client"; // error.tsx boundaries must be Client Components

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LearnError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Something went wrong</h1>
      <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
        We couldn&apos;t load this page. Try again, and if it keeps happening, let us know.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
