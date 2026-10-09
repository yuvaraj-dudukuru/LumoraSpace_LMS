import "server-only";
import { prisma } from "@/lib/prisma";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: Date;
};

export type NotificationFilter = "all" | "unread";

const INBOX_LIMIT = 100;

/** The caller's own inbox, newest first, capped at INBOX_LIMIT. Always
 * filtered by `userId` — callers pass the signed-in user's id, never one
 * from the request. */
export async function getNotificationsForUser(userId: string, filter: NotificationFilter = "all"): Promise<NotificationItem[]> {
  return prisma.notification.findMany({
    where: { userId, read: filter === "unread" ? false : undefined },
    orderBy: { createdAt: "desc" },
    take: INBOX_LIMIT,
    select: { id: true, type: true, title: true, body: true, actionUrl: true, read: true, createdAt: true },
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export type NotificationGroup = { label: "Today" | "Yesterday" | "Earlier"; items: NotificationItem[] };

/** Pure. Buckets by local calendar day relative to `now`; empty groups dropped. */
export function groupNotificationsByDay(items: NotificationItem[], now: Date): NotificationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const groups: NotificationGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const item of items) {
    const time = item.createdAt.getTime();
    groups[time >= startOfToday ? 0 : time >= startOfYesterday ? 1 : 2].items.push(item);
  }
  return groups.filter((group) => group.items.length > 0);
}
