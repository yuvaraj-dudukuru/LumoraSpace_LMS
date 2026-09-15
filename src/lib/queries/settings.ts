import "server-only";
import { prisma } from "@/lib/prisma";

export type SettingsProfile = {
  name: string;
  email: string;
  bio: string | null;
  hasPassword: boolean;
};

/** ANY signed-in role reads/writes their own row here — DECISIONS.md Q9,
 * settings_profile_desktop/settings_security_desktop. `hasPassword` is false
 * for a Google-OAuth-only account (User.passwordHash null) — the page uses
 * this to explain why the change-password form is disabled instead of
 * rendering a form that would just fail. */
export async function getProfileForSettings(userId: string): Promise<SettingsProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, bio: true, passwordHash: true },
  });
  if (!user) return null;

  return {
    name: user.name,
    email: user.email,
    bio: user.bio,
    hasPassword: user.passwordHash !== null,
  };
}
