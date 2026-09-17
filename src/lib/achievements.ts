import type { ProgramProgress } from "@/lib/queries/progress";

/** Phase A — achievements are DERIVED, never stored, and there are exactly
 * four kinds (no badge model exists in the schema; nothing else is
 * invented). Pure: the counts come from data the dashboard already fetched.
 * Only kinds with a count above zero are returned. */
export type AchievementKind = "streak" | "modules_completed" | "graded_assessments_passed" | "certificates";

export type Achievement = { kind: AchievementKind; count: number; label: string };

export type AchievementInput = {
  /** User.streakDays — the stored counter (see docs/CONTRACTS.md, Streak). */
  streakDays: number;
  /** Modules at 100% (with at least one lesson) count as completed. */
  progress: ProgramProgress;
  /** Distinct GRADED assessments with a passed attempt, for this enrollment. */
  passedGradedAssessmentCount: number;
  /** VALID certificates for the learner (all programs). */
  validCertificateCount: number;
};

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function deriveAchievements(input: AchievementInput): Achievement[] {
  const modulesCompleted = input.progress.modules.filter(
    (programModule) => programModule.totalLessons > 0 && programModule.percent === 100,
  ).length;
  const passed = input.passedGradedAssessmentCount;
  const certificates = input.validCertificateCount;

  const all: Achievement[] = [
    { kind: "streak", count: input.streakDays, label: `${input.streakDays}-Day Streak` },
    {
      kind: "modules_completed",
      count: modulesCompleted,
      label: `${modulesCompleted} ${plural(modulesCompleted, "Module", "Modules")} Completed`,
    },
    {
      kind: "graded_assessments_passed",
      count: passed,
      label: `${passed} Graded ${plural(passed, "Assessment", "Assessments")} Passed`,
    },
    {
      kind: "certificates",
      count: certificates,
      label: `${certificates} ${plural(certificates, "Certificate", "Certificates")}`,
    },
  ];
  return all.filter((achievement) => achievement.count > 0);
}
