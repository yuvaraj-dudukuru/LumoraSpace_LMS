// Authorization primitives — built once here so M3+ don't each reinvent role
// checks. Every function below queries the DB server-side; none trusts a
// client-supplied role, id, or enrollment (the JWT's role/onboardingComplete
// is only ever trusted by middleware for coarse gating — see auth.config.ts).
//
// Split into two layers:
//   - Pure predicates (findCurrentUserById, findEnrollment,
//     isEnrollmentGranted, isMentorForBatch): plain DB reads, no Next.js
//     request-context APIs. Safe to call from a script or test outside a
//     request — see scripts/verify-guards.ts.
//   - require* wrappers: call auth()/redirect()/forbidden(), which only work
//     inside a real request (Server Component/Action). These are what pages
//     actually call.
import { forbidden, redirect } from "next/navigation";
import type { Enrollment, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  onboardingComplete: boolean;
};

export async function findCurrentUserById(userId: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      onboardingComplete: true,
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    onboardingComplete: user.onboardingComplete,
  };
}

export async function findEnrollment(userId: string, programId: string): Promise<Enrollment | null> {
  return prisma.enrollment.findFirst({ where: { userId, programId } });
}

/** DECISIONS.md Q22 — a PENDING/AWAITING enrollment has no content access. */
export function isEnrollmentGranted(enrollment: Enrollment | null): boolean {
  return enrollment !== null && enrollment.accessState === "GRANTED";
}

export async function isMentorForBatch(
  user: Pick<CurrentUser, "id" | "role">,
  batchId: string,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "MENTOR") return false;

  const assignment = await prisma.mentorAssignment.findFirst({
    where: { mentorId: user.id, batchId },
  });
  return assignment !== null;
}

/** Session user or null. Re-fetches from the DB — a demoted/deactivated
 * user's stale JWT never grants access here, even before the token refreshes. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return findCurrentUserById(session.user.id);
}

/** Current user, or redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Current user if their role is one of `roles`, else render 403. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) forbidden();
  return user;
}

/** The caller's Enrollment for `programId`, else 403. */
export async function requireEnrollment(programId: string): Promise<Enrollment> {
  const user = await requireUser();
  const enrollment = await findEnrollment(user.id, programId);
  if (!enrollment) forbidden();
  return enrollment;
}

/** Same as requireEnrollment, but also requires accessState = GRANTED. */
export async function requireGrantedEnrollment(programId: string): Promise<Enrollment> {
  const enrollment = await requireEnrollment(programId);
  if (!isEnrollmentGranted(enrollment)) forbidden();
  return enrollment;
}

/** Current user if they're an ADMIN, or a MENTOR with a MentorAssignment to
 * `batchId`, else 403. */
export async function requireMentorForBatch(batchId: string): Promise<CurrentUser> {
  const user = await requireUser();
  const allowed = await isMentorForBatch(user, batchId);
  if (!allowed) forbidden();
  return user;
}
