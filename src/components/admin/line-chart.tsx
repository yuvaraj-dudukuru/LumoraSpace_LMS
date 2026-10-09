"use client"; // hover crosshair + tooltip need pointer state

import { useState } from "react";

export type ChartSeries = { label: string; values: number[] };

// Series colours in fixed order — see globals.css (--color-series-*).
const STROKE = ["stroke-series-1", "stroke-series-2", "stroke-series-3"] as const;
const FILL = ["fill-series-1", "fill-series-2", "fill-series-3"] as const;
const SWATCH = ["bg-series-1", "bg-series-2", "bg-series-3"] as const;
export const MAX_CHART_SERIES = STROKE.length;

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const GRID_LINES = 4;

/** A "nice" axis top: the smallest 1/2/5 × 10ⁿ step that fits `max` in GRID_LINES. */
function axisMax(max: number): number {
  if (max <= GRID_LINES) return GRID_LINES;
  const rough = max / GRID_LINES;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? rough;
  return step * GRID_LINES;
}

/** Change-over-time for up to three count series sharing ONE y-axis. Always
 * ships a legend and a table view, so no series is identified by colour alone. */
export function LineChart({
  title,
  labels,
  series,
}: {
  /** Names the chart for assistive tech and captions the table view. */
  title: string;
  /** One x label per point, e.g. "Oct 1". */
  labels: string[];
  series: ChartSeries[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.slice(0, MAX_CHART_SERIES);
  const points = labels.length;
  const top = axisMax(Math.max(0, ...shown.flatMap((line) => line.values)));

  const x = (index: number) => PAD.left + (points <= 1 ? PLOT_WIDTH / 2 : (index / (points - 1)) * PLOT_WIDTH);
  const y = (value: number) => PAD.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;

  // At most ~6 x labels, always including the first and last point.
  const labelEvery = Math.max(1, Math.ceil(points / 6));
  const showLabel = (index: number) => index === points - 1 || (index % labelEvery === 0 && points - 1 - index >= labelEvery / 2);

  function handleMove(event: React.PointerEvent<SVGSVGElement>): void {
    const box = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * WIDTH;
    const ratio = points <= 1 ? 0 : (svgX - PAD.left) / PLOT_WIDTH;
    setHover(Math.min(points - 1, Math.max(0, Math.round(ratio * (points - 1)))));
  }

  if (points === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">No data for this period.</p>;
  }

  return (
    <figure className="flex flex-col gap-md">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${title}. ${shown.map((line) => `${line.label}: ${line.values.reduce((sum, value) => sum + value, 0)} in total`).join("; ")}.`}
          className="h-auto w-full touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        >
          {Array.from({ length: GRID_LINES + 1 }, (_, line) => {
            const value = (top / GRID_LINES) * line;
            return (
              <g key={line}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-outline-variant/50" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle" className="fill-on-surface-variant text-label-sm">
                  {value}
                </text>
              </g>
            );
          })}

          {labels.map((label, index) =>
            showLabel(index) ? (
              <text key={index} x={x(index)} y={HEIGHT - 8} textAnchor={index === 0 ? "start" : index === points - 1 ? "end" : "middle"} className="fill-on-surface-variant text-label-sm">
                {label}
              </text>
            ) : null,
          )}

          {shown.map((line, lineIndex) => (
            <polyline
              key={line.label}
              points={line.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={STROKE[lineIndex]}
            />
          ))}

          {hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + PLOT_HEIGHT} className="stroke-outline" strokeWidth={1} strokeDasharray="4 4" />
              {shown.map((line, lineIndex) => (
                <circle key={line.label} cx={x(hover)} cy={y(line.values[hover] ?? 0)} r={5} strokeWidth={2} className={`${FILL[lineIndex]} stroke-surface-container-lowest`} />
              ))}
            </g>
          ) : null}
        </svg>

        {hover !== null ? (
          <div
            className={`pointer-events-none absolute top-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-sm shadow-sm ${hover > points / 2 ? "left-12" : "right-2"}`}
          >
            <p className="font-label-sm text-label-sm text-on-surface-variant">{labels[hover]}</p>
            {shown.map((line, lineIndex) => (
              <p key={line.label} className="flex items-center gap-sm font-label-md text-label-md text-on-surface">
                <span className={`h-2.5 w-2.5 rounded-full ${SWATCH[lineIndex]}`} aria-hidden="true" />
                {line.label}: {line.values[hover] ?? 0}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <figcaption className="flex flex-wrap items-center gap-lg">
        {shown.map((line, lineIndex) => (
          <span key={line.label} className="flex items-center gap-sm font-label-md text-label-md text-on-surface">
            <span className={`h-2.5 w-2.5 rounded-full ${SWATCH[lineIndex]}`} aria-hidden="true" />
            {line.label}
          </span>
        ))}
      </figcaption>

      <details>
        <summary className="cursor-pointer font-label-md text-label-md text-primary hover:underline">View as table</summary>
        <div className="mt-sm overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-outline-variant/40">
                <th className="p-sm font-label-sm text-label-sm text-on-surface-variant">Period starting</th>
                {shown.map((line) => (
                  <th key={line.label} className="p-sm text-right font-label-sm text-label-sm text-on-surface-variant">
                    {line.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, index) => (
                <tr key={index} className="border-b border-outline-variant/20 last:border-0">
                  <td className="p-sm font-label-md text-label-md text-on-surface">{label}</td>
                  {shown.map((line) => (
                    <td key={line.label} className="p-sm text-right font-label-md text-label-md text-on-surface">
                      {line.values[index] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
