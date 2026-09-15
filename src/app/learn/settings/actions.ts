"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validations/settings";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

// ANY signed-in role (DECISIONS.md Q9) — requireUser() alone is the correct
// guard here, same as lesson notes (learn/lessons/[lessonId]/actions.ts):
// this only ever touches the caller's own row via requireUser()'s id, never
// an id from the client.
export async function updateProfile(input: { name: string; bio: string }): Promise<SettingsActionResult> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, bio: parsed.data.bio || null },
  });

  revalidatePath("/learn/settings");
  revalidatePath("/mentor/settings");
  return { ok: true };
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<SettingsActionResult> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record?.passwordHash) {
    return { ok: false, error: "Your account signs in with Google — there's no password to change." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { ok: true };
}
