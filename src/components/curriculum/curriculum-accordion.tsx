"use client"; // needs open/closed accordion state per module

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, PlayCircle, FileText, HelpCircle } from "lucide-react";
import type { LessonType } from "@prisma/client";

export type CurriculumLesson = {
  id: string;
  title: string;
  description?: string | null;
  type: LessonType;
  completed?: boolean;
};

export type CurriculumModuleData = {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  lessons: CurriculumLesson[];
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
  QUIZ: HelpCircle,
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
                          <h4 className="font-label-md text-label-md text-on-surface">{lesson.title}</h4>
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
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
