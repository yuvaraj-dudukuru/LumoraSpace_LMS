"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import {
  createUserSchema,
  updateUserRoleSchema,
  setUserStatusSchema,
  assignMentorSchema,
  resetUserPasswordSchema,
  wouldSelfDemote,
  wouldSelfDeactivate,
} from "@/lib/validations/admin";

function revalidateUsers(userId?: string): void {
  revalidatePath("/admin/users");
  if (userId) revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin");
}

export type UserActionResult = { ok: true } | { ok: false; error: string };

/** How MENTOR and ADMIN accounts get made — public signup always creates
 * LEARNER (DECISIONS Q15). Same bcrypt discipline as signupAction. No
 * confirmPassword: an admin is acting on someone else's behalf here. */
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<UserActionResult> {
  await requireRole("ADMIN");

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { ok: false, error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: parsed.data.role },
  });

  revalidateUsers();
  return { ok: true };
}

/** Blocks an admin from demoting themselves — see
 * validations/admin.ts:wouldSelfDemote. Without this, the only admin account
 * could lock everyone (including itself) out of /admin. */
export async function updateUserRole(userId: string, input: { role: string }): Promise<UserActionResult> {
  const caller = await requireRole("ADMIN");

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid role." };

  if (wouldSelfDemote(caller.id, userId, parsed.data.role)) {
    return { ok: false, error: "You cannot change your own role away from ADMIN." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.user.update({ where: { id: userId }, data: { role: parsed.data.role } });

  revalidateUsers(userId);
  return { ok: true };
}

/** findCurrentUserById already returns null for a non-ACTIVE user (see
 * auth-guards.ts), so setting INACTIVE here is a fully working deactivation
 * with no other changes needed. Guarded against self-lockout the same way
 * as updateUserRole (see validations/admin.ts:wouldSelfDeactivate) — not
 * explicitly asked for in the task, but the identical risk. */
export async function setUserStatus(userId: string, input: { status: string }): Promise<UserActionResult> {
  const caller = await requireRole("ADMIN");

  const parsed = setUserStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status." };

  if (wouldSelfDeactivate(caller.id, userId, parsed.data.status)) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.user.update({ where: { id: userId }, data: { status: parsed.data.status } });

  revalidateUsers(userId);
  return { ok: true };
}

/** The only password-reset path in the app: there is no self-service
 * forgot-password flow. ADMIN-only, min 8 chars (resetUserPasswordSchema),
 * bcrypt cost 10 — same hashing discipline as signupAction/createUser. The
 * new password is never logged or returned. Works for an OAuth-only account
 * too (passwordHash was null) — that deliberately enables credentials login
 * for it, since an admin is choosing to. */
export async function resetUserPassword(userId: string, newPassword: string): Promise<UserActionResult> {
  await requireRole("ADMIN");

  const parsed = resetUserPasswordSchema.safeParse({ newPassword });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found." };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidateUsers(userId);
  return { ok: true };
}

/** Without this, mentors can only be assigned via the seed. Verifies the
 * target actually has role MENTOR — otherwise a MentorAssignment row could
 * point at a LEARNER/ADMIN account; every M5b query would just silently
 * filter it out at getMentorBatchIds, which is inert but clearly wrong. */
export async function assignMentorToBatch(
  mentorId: string,
  input: { batchId: string; roleLabel?: string },
): Promise<UserActionResult> {
  await requireRole("ADMIN");

  const parsed = assignMentorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor) return { ok: false, error: "User not found." };
  if (mentor.role !== "MENTOR") return { ok: false, error: "Only MENTOR accounts can be assigned to a batch." };

  const batch = await prisma.batch.findUnique({ where: { id: parsed.data.batchId } });
  if (!batch) return { ok: false, error: "Batch not found." };

  try {
    await prisma.mentorAssignment.create({
      data: { mentorId, batchId: parsed.data.batchId, roleLabel: parsed.data.roleLabel || null },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "This mentor is already assigned to that batch." };
    }
    throw error;
  }

  revalidateUsers(mentorId);
  return { ok: true };
}

export async function removeMentorFromBatch(mentorAssignmentId: string, mentorId: string): Promise<UserActionResult> {
  await requireRole("ADMIN");

  const assignment = await prisma.mentorAssignment.findUnique({ where: { id: mentorAssignmentId } });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  await prisma.mentorAssignment.delete({ where: { id: mentorAssignmentId } });

  revalidateUsers(mentorId);
  return { ok: true };
}
