"use client"; // needs local tab-filter state

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { AccessState, EnrollmentStatus } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";

export type EnrollmentCardData = {
  enrollmentId: string;
  programId: string;
  programName: string;
  status: EnrollmentStatus;
  accessState: AccessState;
  overallPercent: number;
  completedLessons: number;
  totalLessons: number;
  currentLessonId: string | null;
  currentLessonTitle: string | null;
  currentModuleTitle: string | null;
};

type Filter = "all" | "in_progress" | "completed";

function matchesFilter(card: EnrollmentCardData, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return card.status === "COMPLETED";
  if (filter === "in_progress") return card.status === "ACTIVE";
  return true;
}

export function MyLearningGrid({ cards }: { cards: EnrollmentCardData[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          You haven&apos;t enrolled in any programs yet.
        </p>
        <Link href="/programs" className={buttonVariants({ variant: "default" })}>
          Browse Programs
        </Link>
      </div>
    );
  }

  const visible = cards.filter((card) => matchesFilter(card, filter));

  return (
    <div>
      <div className="mb-xl flex gap-md overflow-x-auto pb-sm">
        {(["all", "in_progress", "completed"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`whitespace-nowrap border-b-2 pb-unit font-label-md text-label-md transition-colors ${
              filter === tab
                ? "border-primary text-on-surface"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab === "all" ? "All" : tab === "in_progress" ? "In Progress" : "Completed"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">No courses in this filter yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
          {visible.map((card) => (
            <EnrollmentCard key={card.enrollmentId} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnrollmentCard({ card }: { card: EnrollmentCardData }) {
  const isPending = card.accessState !== "GRANTED";
  const isCompleted = card.status === "COMPLETED";

  const body = (
    <div className="flex h-full flex-col rounded-xl border border-outline-variant/40 bg-surface p-lg shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-md flex items-center justify-between">
        <h3 className="font-title-lg text-title-lg leading-snug text-on-surface">{card.programName}</h3>
        {isPending ? (
          <span className="flex shrink-0 items-center gap-xs rounded-full bg-surface-variant px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
            <Clock className="h-3 w-3" />
            Pending Access
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-primary">
            {isCompleted ? "Completed" : "In Progress"}
          </span>
        )}
      </div>

      {isPending ? (
        <p className="font-body-md text-sm text-on-surface-variant">
          Your enrollment is awaiting admin approval. You&apos;ll get access to lessons once it&apos;s
          granted.
        </p>
      ) : (
        <div className="mt-auto flex flex-col gap-sm">
          <div className="mb-unit flex items-end justify-between">
            <span className="font-label-sm text-label-sm text-on-surface">{card.overallPercent}% complete</span>
            <span className="font-body-md text-[11px] text-on-surface-variant">
              {card.completedLessons} of {card.totalLessons} lessons
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${card.overallPercent}%` }} />
          </div>
          {card.currentLessonTitle ? (
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-sm">
              <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
                {isCompleted ? "COMPLETED" : "CURRENTLY LEARNING"}
              </p>
              {card.currentModuleTitle ? (
                <p className="truncate font-body-md text-sm text-on-surface">{card.currentModuleTitle}</p>
              ) : null}
              <p className="truncate font-body-md text-xs text-on-surface-variant">{card.currentLessonTitle}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  if (isPending) {
    // Explicitly not a Link — an AWAITING enrollment must not be clickable
    // into content.
    return <div>{body}</div>;
  }

  const href = card.currentLessonId
    ? `/learn/lessons/${card.currentLessonId}`
    : `/learn/programs/${card.programId}`;

  return <Link href={href}>{body}</Link>;
}
