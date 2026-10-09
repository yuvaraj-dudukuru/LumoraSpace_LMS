import "server-only";
import { prisma } from "@/lib/prisma";

/** Small option lists for the admin dialogs' <select>s. ADMIN-only callers. */

export type Option = { value: string; label: string };

/** Programs a new batch / module / assessment can be attached to: everything
 * except ARCHIVED (an archived program takes no new content or cohorts). */
export async function getProgramOptions(): Promise<Option[]> {
  const programs = await prisma.program.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  return programs.map((program) => ({
    value: program.id,
    label: program.status === "DRAFT" ? `${program.name} (draft)` : program.name,
  }));
}

/** ACTIVE accounts with role MENTOR. */
export async function getMentorOptions(): Promise<Option[]> {
  const mentors = await prisma.user.findMany({
    where: { role: "MENTOR", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return mentors.map((mentor) => ({ value: mentor.id, label: `${mentor.name} — ${mentor.email}` }));
}

/** ACTIVE accounts with role LEARNER. */
export async function getLearnerOptions(): Promise<Option[]> {
  const learners = await prisma.user.findMany({
    where: { role: "LEARNER", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return learners.map((learner) => ({ value: learner.id, label: `${learner.name} — ${learner.email}` }));
}

/** UPCOMING/ACTIVE batches of non-archived programs — the ones that can take a new enrollment. */
export async function getOpenBatchOptions(): Promise<Option[]> {
  const batches = await prisma.batch.findMany({
    where: { status: { in: ["UPCOMING", "ACTIVE"] }, program: { status: { not: "ARCHIVED" } } },
    orderBy: [{ program: { name: "asc" } }, { startDate: "asc" }],
    select: { id: true, code: true, name: true, program: { select: { name: true } } },
  });
  return batches.map((batch) => ({ value: batch.id, label: `${batch.program.name} — ${batch.name} (${batch.code})` }));
}

/** Every module, labelled with its program — for "create assessment". */
export async function getModuleOptions(): Promise<Option[]> {
  const modules = await prisma.module.findMany({
    where: { program: { status: { not: "ARCHIVED" } } },
    orderBy: [{ program: { name: "asc" } }, { order: "asc" }],
    select: { id: true, title: true, order: true, program: { select: { name: true } } },
  });
  return modules.map((programModule) => ({
    value: programModule.id,
    label: `${programModule.program.name} — ${String(programModule.order).padStart(2, "0")} ${programModule.title}`,
  }));
}
