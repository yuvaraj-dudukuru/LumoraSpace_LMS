"use client"; // needs open/closed accordion state per module

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, PlayCircle, FileText, FileQuestion, ClipboardList, CalendarClock } from "lucide-react";
import type { LessonType, AssignmentType } from "@prisma/client";
import type { AttemptState, AssignmentSubmissionState } from "@/lib/queries/progress";
import { formatDate } from "@/lib/format";

export type CurriculumLesson = {
  id: string;
  title: string;
  description?: string | null;
  type: LessonType;
  completed?: boolean;
  /** Only meaningful for QUIZ lessons in "learner" mode; null once completed
   * (the checkmark already means "passed") or when there's no linked
   * assessment. See queries/progress.ts's deriveAttemptState. */
  attemptState?: AttemptState | null;
};

/** D2 — module-level, not lesson-level (Assignment has no Lesson FK).
 * Learner mode only; catalog (public, unenrolled) viewers see no submission
 * state, so this is omitted there entirely. */
export type CurriculumAssignment = {
  id: string;
  title: string;
  type: AssignmentType;
  dueAt: Date | null;
  state: AssignmentSubmissionState;
  score: number | null;
  maxScore: number | null;
};

export type CurriculumModuleData = {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  lessons: CurriculumLesson[];
  assignments?: CurriculumAssignment[];
  percent?: number;
};

type Props = {
  modules: CurriculumModuleData[];
  /** "catalog" = public, read-only, no completion state, no links.
   * "learner" = completion ticks + links into /learn/lessons/[id]. */
  mode: "catalog" | "learner";
  defaultOpenModuleId?: string;
};

const LESSON_ICON: Record<LessonType, typeof PlayCircle> = {
  VIDEO: PlayCircle,
  READING: FileText,
  QUIZ: FileQuestion,
};

const ATTEMPT_STATE_LABEL: Record<AttemptState, string> = {
  not_attempted: "Not attempted",
  in_progress: "In progress",
  failed: "Failed",
};

const ATTEMPT_STATE_STYLE: Record<AttemptState, string> = {
  not_attempted: "bg-surface-container text-on-surface-variant",
  in_progress: "bg-warning-container text-warning",
  failed: "bg-error-container text-on-error-container",
};

const ASSIGNMENT_STATE_LABEL: Record<AssignmentSubmissionState, string> = {
  not_started: "Not started",
  submitted: "Submitted",
  under_review: "Under review",
  revision_requested: "Revision requested",
  reviewed: "Reviewed",
};

const ASSIGNMENT_STATE_STYLE: Record<AssignmentSubmissionState, string> = {
  not_started: "bg-surface-container text-on-surface-variant",
  submitted: "bg-primary-fixed text-primary",
  under_review: "bg-warning-container text-warning",
  revision_requested: "bg-error-container text-on-error-container",
  reviewed: "bg-success-container text-success",
};

export function CurriculumAccordion({ modules, mode, defaultOpenModuleId }: Props) {
  const [openModuleId, setOpenModuleId] = useState<string | null>(
    defaultOpenModuleId ?? modules[0]?.id ?? null,
  );

  return (
    <div className="flex flex-col gap-md">
      {modules.map((curriculumModule) => {
        const isOpen = openModuleId === curriculumModule.id;
        const isComplete = mode === "learner" && curriculumModule.percent === 100;

        return (
          <div
            key={curriculumModule.id}
            className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface shadow-sm"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenModuleId(isOpen ? null : curriculumModule.id)}
              className="flex w-full items-center justify-between px-lg py-md text-left"
            >
              <div className="flex items-center gap-md">
                {mode === "learner" ? (
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isComplete ? "bg-primary-container text-on-primary-container" : "border border-outline"
                    }`}
                  >
                    {isComplete ? <Check className="h-4 w-4" /> : null}
                  </span>
                ) : (
                  <span className="font-headline-md text-headline-md text-outline">
                    {String(curriculumModule.order).padStart(2, "0")}
                  </span>
                )}
                <span className="font-title-lg text-title-lg text-on-surface">{curriculumModule.title}</span>
                {mode === "learner" && curriculumModule.percent !== undefined ? (
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {curriculumModule.percent}%
                  </span>
                ) : null}
              </div>
              <ChevronDown
                className={`h-5 w-5 text-outline transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen ? (
              <div className="px-lg pb-lg">
                {curriculumModule.description ? (
                  <p className="mb-md font-body-md text-body-md text-on-surface-variant">
                    {curriculumModule.description}
                  </p>
                ) : null}
                <ul className="flex flex-col">
                  {curriculumModule.lessons.map((lesson) => {
                    const Icon = LESSON_ICON[lesson.type];
                    const content = (
                      <div className="flex items-start gap-md border-t border-outline-variant/20 py-sm">
                        {mode === "learner" ? (
                          lesson.completed ? (
                            <Check className="mt-xs h-5 w-5 shrink-0 text-primary" />
                          ) : (
                            <Icon className="mt-xs h-5 w-5 shrink-0 text-on-surface-variant" />
                          )
                        ) : (
                          <Icon className="mt-xs h-5 w-5 shrink-0 text-primary" />
                        )}
                        <div>
                          <div className="flex items-center gap-sm">
                            <h4 className="font-label-md text-label-md text-on-surface">{lesson.title}</h4>
                            {mode === "learner" && lesson.type === "QUIZ" && lesson.attemptState ? (
                              <span
                                className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${ATTEMPT_STATE_STYLE[lesson.attemptState]}`}
                              >
                                {ATTEMPT_STATE_LABEL[lesson.attemptState]}
                              </span>
                            ) : null}
                          </div>
                          {lesson.description ? (
                            <p className="mt-xs font-body-md text-sm text-on-surface-variant">
                              {lesson.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                    return (
                      <li key={lesson.id}>
                        {mode === "learner" ? (
                          <Link href={`/learn/lessons/${lesson.id}`} className="block hover:bg-surface-container-high">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>

                {mode === "learner" && curriculumModule.assignments && curriculumModule.assignments.length > 0 ? (
                  <div className="mt-md border-t border-outline-variant/20 pt-md">
                    <h5 className="mb-sm font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      Assignments
                    </h5>
                    <ul className="flex flex-col gap-xs">
                      {curriculumModule.assignments.map((assignment) => (
                        <li key={assignment.id}>
                          <Link
                            href={`/learn/assignments/${assignment.id}`}
                            className="flex flex-wrap items-center gap-sm rounded-lg p-sm hover:bg-surface-container-high"
                          >
                            <ClipboardList className="h-4 w-4 shrink-0 text-on-surface-variant" />
                            <span className="font-label-md text-label-md text-on-surface">{assignment.title}</span>
                            <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
                              {assignment.type === "PROJECT" ? "Project" : "Assignment"}
                            </span>
                            {assignment.dueAt ? (
                              <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                                <CalendarClock className="h-3.5 w-3.5" /> {formatDate(assignment.dueAt)}
                              </span>
                            ) : null}
                            <span
                              className={`ml-auto rounded-full px-sm py-xs font-label-sm text-label-sm ${ASSIGNMENT_STATE_STYLE[assignment.state]}`}
                            >
                              {ASSIGNMENT_STATE_LABEL[assignment.state]}
                              {assignment.state === "reviewed" && assignment.score !== null
                                ? ` — ${assignment.score}/${assignment.maxScore}`
                                : ""}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
