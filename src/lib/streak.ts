/** Streak bookkeeping for User.streakDays / User.lastActiveAt.
 *
 * "A day" is a calendar day in ONE fixed timezone, STREAK_TIMEZONE — not the
 * server's zone (UTC on Vercel) and not the learner's browser. A cohort
 * program has one schedule, so one zone is the honest choice; a
 * per-learner zone would need a column the schema doesn't have.
 *
 * Pure — no DB, no Date.now() — so it's checkable without a database. The
 * ONLY writer is markLessonComplete (src/app/learn/lessons/[lessonId]/
 * actions.ts); see docs/CONTRACTS.md. */

export const STREAK_TIMEZONE = "Asia/Kolkata";

export type StreakState = {
  streakDays: number;
  lastActiveAt: Date | null;
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STREAK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Days since the Unix epoch for the calendar day `at` falls on in
 * STREAK_TIMEZONE. Two instants on the same local day map to the same
 * integer; consecutive local days differ by exactly 1 — DST-safe because
 * the arithmetic happens on the extracted Y-M-D, not on the instants. */
export function calendarDayIndex(at: Date): number {
  const parts = dayFormatter.formatToParts(at);
  const get = (type: "year" | "month" | "day"): number =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);
  return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

/** The next streak state after activity at `now`:
 *   - no previous activity  → 1
 *   - same calendar day     → streak unchanged (never below 1)
 *   - the very next day     → +1
 *   - any longer gap        → reset to 1
 * lastActiveAt always becomes `now` — it is "last active", not "streak
 * anchor", so it moves on every completion including same-day ones. */
export function nextStreakState(previous: StreakState, now: Date): StreakState {
  if (previous.lastActiveAt === null) {
    return { streakDays: 1, lastActiveAt: now };
  }

  const gapDays = calendarDayIndex(now) - calendarDayIndex(previous.lastActiveAt);
  if (gapDays === 0) {
    return { streakDays: Math.max(previous.streakDays, 1), lastActiveAt: now };
  }
  if (gapDays === 1) {
    return { streakDays: previous.streakDays + 1, lastActiveAt: now };
  }
  // gapDays >= 2, or negative (clock skew / a lastActiveAt in the future):
  // either way the chain is broken — start over from today.
  return { streakDays: 1, lastActiveAt: now };
}
