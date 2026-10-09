import { requireRole } from "@/lib/auth-guards";
import { getProgramPerformance } from "@/lib/queries/admin-analytics";
import { csvResponse } from "@/lib/csv";

/** "Export Report" on /admin/analytics — the Program Performance table as CSV. */
export async function GET(): Promise<Response> {
  await requireRole("ADMIN");
  const programs = await getProgramPerformance();
  return csvResponse("program-performance", [
    ["Program", "Status", "Enrollments", "Active", "Completed", "Completion %", "Average progress %", "Valid certificates"],
    ...programs.map((program) => [
      program.name,
      program.status,
      program.enrollments,
      program.active,
      program.completed,
      program.completionPercent,
      program.averageProgressPercent,
      program.certificates,
    ]),
  ]);
}
