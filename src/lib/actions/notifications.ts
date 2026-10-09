"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";

// Layout-level: the unread badge lives in the shell, so every page under
// either inbox's section needs refreshing.
function revalidateInboxes(): void {
  revalidatePath("/admin", "layout");
  revalidatePath("/learn", "layout");
}

/** Any signed-in user, their own rows only: `updateMany` is filtered on the
 * caller's id, so someone else's notification id simply matches nothing. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
  revalidateInboxes();
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidateInboxes();
  return { ok: true };
}
