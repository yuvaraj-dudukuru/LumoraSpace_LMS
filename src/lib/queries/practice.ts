import "server-only";
import { prisma } from "@/lib/prisma";

/** Phase A — /learn/practice. PUBLISHED assessments with kind PRACTICE
 * across every program the learner has a GRANTED enrollment in, grouped
 * program → module, with this learner's attempts summarised. Attempts are
 * matched by user (a learner holds one enrollment per program in the MVP;
 * two enrollments in the same program would merge their attempts here). */

export type PracticeAssessmentItem = {
  id: string;
  title: string;
  timeLimitMins: number | null;
  /** 0 = unlimited (Assessment.allowedAttempts). */
  allowedAttempts: number;
  /** SUBMITTED + GRADED attempts. */
  attemptsUsed: number;
  /** Highest scorePercent over graded attempts; null when none. */
  bestScorePercent: number | null;
  inProgress: boolean;
  attemptsExhausted: boolean;
  /** The existing assessment flow (its page resumes an in-progress attempt). */
  href: string;
};

export type PracticeModuleGroup = {
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  items: PracticeAssessmentItem[];
};

export type PracticeProgramGroup = {
  programId: string;
  programName: string;
  modules: PracticeModuleGroup[];
};

/** One query, grouped in memory. */
export async function getPracticeAssessments(userId: string): Promise<PracticeProgramGroup[]> {
  const assessments = await prisma.assessment.findMany({
    where: {
      kind: "PRACTICE",
      status: "PUBLISHED",
      module: { program: { enrollments: { some: { userId, accessState: "GRANTED" } } } },
    },
    orderBy: [{ module: { program: { name: "asc" } } }, { module: { order: "asc" } }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      timeLimitMins: true,
      allowedAttempts: true,
      module: {
        select: { id: true, title: true, order: true, program: { select: { id: true, name: true } } },
      },
      attempts: {
        where: { enrollment: { userId } },
        select: { status: true, scorePercent: true },
      },
    },
  });

  const programs = new Map<string, PracticeProgramGroup>();
  for (const assessment of assessments) {
    const program = assessment.module.program;
    const programGroup = programs.get(program.id) ?? { programId: program.id, programName: program.name, modules: [] };
    programs.set(program.id, programGroup);

    let moduleGroup = programGroup.modules.find((m) => m.moduleId === assessment.module.id);
    if (!moduleGroup) {
      moduleGroup = {
        moduleId: assessment.module.id,
        moduleTitle: assessment.module.title,
        moduleOrder: assessment.module.order,
        items: [],
      };
      programGroup.modules.push(moduleGroup);
    }

    const finished = assessment.attempts.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED");
    const graded = assessment.attempts.filter((a) => a.status === "GRADED" && a.scorePercent !== null);
    const bestScorePercent = graded.length === 0 ? null : Math.max(...graded.map((a) => a.scorePercent ?? 0));
    const inProgress = assessment.attempts.some((a) => a.status === "IN_PROGRESS");
    const attemptsExhausted =
      !inProgress && assessment.allowedAttempts !== 0 && finished.length >= assessment.allowedAttempts;

    moduleGroup.items.push({
      id: assessment.id,
      title: assessment.title,
      timeLimitMins: assessment.timeLimitMins,
      allowedAttempts: assessment.allowedAttempts,
      attemptsUsed: finished.length,
      bestScorePercent,
      inProgress,
      attemptsExhausted,
      href: `/learn/assessments/${assessment.id}`,
    });
  }

  return [...programs.values()];
}
