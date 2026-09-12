"use client";
// Needs client-side state for hover tooltips on bar chart

import { useState } from "react";
import type { WeeklyActivityDay } from "@/lib/queries/activity";

export function WeeklyActivityChart({ data }: { data: WeeklyActivityDay[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);

  return (
    <div className="flex h-64 flex-col rounded-xl bg-surface-container-low p-lg">
      <div className="relative mt-auto flex flex-1 items-end justify-between gap-xs sm:gap-sm">
        {/* Dashed grid lines */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1/2 z-0 border-t border-dashed border-outline-variant/30" />
        <div className="pointer-events-none absolute inset-x-0 bottom-full z-0 border-t border-dashed border-outline-variant/30" />

        {data.map((day, i) => {
          const heightPercent = maxMinutes > 0 ? (day.minutes / maxMinutes) * 100 : 0;
          const hours = Math.round((day.minutes / 60) * 10) / 10;
          const isToday = i === data.length - 1;
          const isHovered = hoveredIndex === i;

          return (
            <div
              key={day.label}
              className="group relative z-10 flex flex-1 flex-col items-center"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className={`w-full rounded-t-sm transition-colors ${
                  day.minutes === 0
                    ? "bg-surface-container-high"
                    : isHovered
                      ? "bg-primary"
                      : heightPercent > 60
                        ? "bg-primary"
                        : heightPercent > 30
                          ? "bg-primary/80"
                          : "bg-surface-container-high"
                }`}
                style={{ height: `${Math.max(heightPercent, 4)}%` }}
              />
              <div
                className={`mt-sm text-center font-label-sm text-label-sm ${
                  isToday
                    ? "font-bold text-on-surface"
                    : "text-on-surface-variant"
                }`}
              >
                {day.label}
              </div>

              {/* Tooltip */}
              {isHovered ? (
                <div className="pointer-events-none absolute -top-10 whitespace-nowrap rounded bg-inverse-surface px-sm py-xs font-label-sm text-label-sm text-inverse-on-surface">
                  {hours} hrs
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
