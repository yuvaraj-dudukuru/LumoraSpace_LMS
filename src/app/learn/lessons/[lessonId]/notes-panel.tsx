"use client"; // needs local textarea state and a 300ms debounce timer for autosave

import { useRef, useState } from "react";
import { saveLessonNotes } from "./actions";

const DEBOUNCE_MS = 300;

export function NotesPanel({ lessonId, initialNotes }: { lessonId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setNotes(value);
    setStatus("idle");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStatus("saving");
      saveLessonNotes(lessonId, value)
        .then((result) => setStatus(result.ok ? "saved" : "error"))
        .catch(() => setStatus("error"));
    }, DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-sm">
      <label htmlFor="lesson-notes" className="font-label-md text-label-md text-on-surface">
        Notes
      </label>
      <textarea
        id="lesson-notes"
        value={notes}
        onChange={(event) => handleChange(event.target.value)}
        rows={6}
        placeholder="Jot down notes as you go…"
        className="w-full rounded-lg border border-outline-variant bg-surface p-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
      />
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save — try again" : ""}
      </span>
    </div>
  );
}
