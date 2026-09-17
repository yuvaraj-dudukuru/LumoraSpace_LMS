import { z } from "zod";
import type { Role, UserStatus } from "@prisma/client";

// Deliberately excludes ACTIVE/COMPLETED — those transitions belong to
// grantAccess and certificate issuance respectively. This action exists only
// for the two terminal states a learner can be moved to manually.
export const updateEnrollmentStatusSchema = z.object({
  status: z.enum(["CANCELLED", "DROPPED"]),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["LEARNER", "MENTOR", "ADMIN"]),
});

/** Admin-set password for another account. There is no self-service
 * forgot-password flow (no email verification/reset-token model in the
 * schema) — the login page tells learners to contact their program admin,
 * and this is what the admin uses. Same 8-char floor as signup/createUser. */
export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["LEARNER", "MENTOR", "ADMIN"]),
});

export const setUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const assignMentorSchema = z.object({
  batchId: z.string().min(1, "Select a batch"),
  roleLabel: z.string().trim().max(80).optional(),
});

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to revoke a certificate"),
});

/** Pure, DB-free — true iff this change would remove ADMIN from the caller's
 * OWN account (the only way to lock everyone out, since updateUserRole is
 * requireRole(ADMIN)-gated already). Testable directly, no DB needed. */
export function wouldSelfDemote(callerId: string, targetUserId: string, newRole: Role): boolean {
  return callerId === targetUserId && newRole !== "ADMIN";
}

/** Same lockout risk, one field over: deactivating your own account also
 * locks you out (findCurrentUserById returns null for non-ACTIVE users).
 * Not explicitly asked for in the task — a consistent extension of the same
 * rule, flagged in the M5c report. */
export function wouldSelfDeactivate(callerId: string, targetUserId: string, newStatus: UserStatus): boolean {
  return callerId === targetUserId && newStatus !== "ACTIVE";
}
