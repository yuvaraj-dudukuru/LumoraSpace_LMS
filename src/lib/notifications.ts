import "server-only";
import type { NotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** The ONLY place that writes Notification rows. In-app only — email stays
 * in src/lib/mail.ts. Like mail.ts, nothing here ever throws: a notification
 * is a side effect of an action that has already committed, so a failure is
 * logged and swallowed rather than failing (or rolling back) the action. */

export const NOTIFICATION_TYPE = {
  ENROLLMENT_REQUEST: "ENROLLMENT_REQUEST",
  ACCESS_GRANTED: "ACCESS_GRANTED",
  ASSIGNMENT_FEEDBACK: "ASSIGNMENT_FEEDBACK",
  PAYMENT_REFUNDED: "PAYMENT_REFUNDED",
  ANNOUNCEMENT: "ANNOUNCEMENT",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  ENROLLMENT_REQUEST: "Enrollment Request",
  ACCESS_GRANTED: "Access Granted",
  ASSIGNMENT_FEEDBACK: "Assignment Feedback",
  PAYMENT_REFUNDED: "Payment",
  ANNOUNCEMENT: "Announcement",
};

type PreferenceFlag = keyof Pick<
  NotificationPreference,
  "courseUpdates" | "assignmentReminders" | "feedbackNotifications" | "mentorUpdates" | "systemNotifications"
>;

/** Which NotificationPreference switch silences each type. A user with no
 * preference row gets everything (PRODUCTION_ROADMAP.md). Admin-facing types
 * have no switch — an admin can't opt out of operational alerts. */
const PREFERENCE_FOR_TYPE: Partial<Record<NotificationType, PreferenceFlag>> = {
  ACCESS_GRANTED: "courseUpdates",
  ASSIGNMENT_FEEDBACK: "feedbackNotifications",
  ANNOUNCEMENT: "systemNotifications",
};

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  /** App-relative path only ("/learn/…") — rendered as a Link, never an external URL. */
  actionUrl?: string;
};

/** Returns how many rows were written (0 on failure or when everyone opted out). */
export async function notify(userIds: string[], input: NotificationInput): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  try {
    const flag = PREFERENCE_FOR_TYPE[input.type];
    let recipients = unique;
    if (flag) {
      const optedOut = await prisma.notificationPreference.findMany({
        where: { userId: { in: unique }, [flag]: false },
        select: { userId: true },
      });
      const silenced = new Set(optedOut.map((row) => row.userId));
      recipients = unique.filter((id) => !silenced.has(id));
    }
    if (recipients.length === 0) return 0;
    const result = await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
      })),
    });
    return result.count;
  } catch (error) {
    console.error("notify: failed to write notifications", { type: input.type, error });
    return 0;
  }
}

/** Every ACTIVE admin. */
export async function notifyAdmins(input: NotificationInput): Promise<number> {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    return await notify(
      admins.map((admin) => admin.id),
      input,
    );
  } catch (error) {
    console.error("notifyAdmins: failed to resolve admins", { type: input.type, error });
    return 0;
  }
}
