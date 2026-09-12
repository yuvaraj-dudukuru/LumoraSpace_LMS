import "server-only";
import { prisma } from "@/lib/prisma";

export type WeeklyActivityDay = { label: string; minutes: number };

export type LearningHoursStats = {
  /** All-time proxy: sum of Lesson.durationMins over this learner's completed
   * lessons, converted to hours. There is no time-tracking model in the
   * schema (see DATA_MODEL.md) — this is a derived stand-in, not measured
   * time, and is documented as such rather than fabricated. */
  totalHours: number;
  /** Last 7 days, oldest first, same durationMins-sum proxy bucketed by the
   * day a lesson was marked complete. */
  weeklyActivity: WeeklyActivityDay[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getLearningHoursStats(userId: string): Promise<LearningHoursStats> {
  const completed = await prisma.lessonProgress.findMany({
    where: { enrollment: { userId }, completed: true, completedAt: { not: null } },
    select: { completedAt: true, lesson: { select: { durationMins: true } } },
  });

  const totalMinutes = completed.reduce((sum, row) => sum + (row.lesson.durationMins ?? 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWindow = new Date(today.getTime() - 6 * MS_PER_DAY);

  const minutesByDay = new Map<string, number>();
  for (const row of completed) {
    if (!row.completedAt || row.completedAt < startOfWindow) continue;
    const dayKey = new Date(row.completedAt);
    dayKey.setHours(0, 0, 0, 0);
    const key = dayKey.toISOString();
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + (row.lesson.durationMins ?? 0));
  }

  const weeklyActivity: WeeklyActivityDay[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWindow.getTime() + i * MS_PER_DAY);
    const key = day.toISOString();
    weeklyActivity.push({
      label: DAY_LABELS[day.getDay()],
      minutes: minutesByDay.get(key) ?? 0,
    });
  }

  return {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    weeklyActivity,
  };
}
