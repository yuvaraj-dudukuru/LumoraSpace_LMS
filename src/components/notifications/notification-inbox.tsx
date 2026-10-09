import Link from "next/link";
import { ArrowRight, Bell, CircleCheck, CreditCard, Megaphone, MessageSquareText, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NOTIFICATION_TYPE_LABEL, type NotificationType } from "@/lib/notifications";
import { groupNotificationsByDay, type NotificationFilter, type NotificationItem } from "@/lib/queries/notifications";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyState, FilterTabs } from "@/components/admin/ui";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  ENROLLMENT_REQUEST: UserPlus,
  ACCESS_GRANTED: CircleCheck,
  ASSIGNMENT_FEEDBACK: MessageSquareText,
  PAYMENT_REFUNDED: CreditCard,
  ANNOUNCEMENT: Megaphone,
};

const ACTION_LABEL: Record<NotificationType, string> = {
  ENROLLMENT_REQUEST: "Review Enrollment",
  ACCESS_GRANTED: "Start Learning",
  ASSIGNMENT_FEEDBACK: "View Feedback",
  PAYMENT_REFUNDED: "View Payment",
  ANNOUNCEMENT: "Open",
};

function isKnownType(type: string): type is NotificationType {
  return type in NOTIFICATION_TYPE_LABEL;
}

/** Only app-relative paths become links — `actionUrl` is written by our own
 * code, but an inbox is the wrong place to trust that blindly. */
function safeActionUrl(actionUrl: string | null): string | null {
  return actionUrl && actionUrl.startsWith("/") && !actionUrl.startsWith("//") ? actionUrl : null;
}

/** The inbox from notifications_lumoraspace, shared by /admin/notifications
 * and /learn/notifications. `basePath` is the page it is rendered on (for
 * the All / Unread tabs). */
export function NotificationInbox({
  items,
  filter,
  basePath,
  unreadCount,
}: {
  items: NotificationItem[];
  filter: NotificationFilter;
  basePath: string;
  unreadCount: number;
}) {
  const groups = groupNotificationsByDay(items, new Date());

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <FilterTabs
          label="Notification filter"
          tabs={[
            { label: "All", href: basePath, active: filter === "all" },
            { label: "Unread", href: `${basePath}?filter=unread`, active: filter === "unread", count: unreadCount },
          ]}
        />
        {unreadCount > 0 ? (
          <ActionButton action={markAllNotificationsRead} variant="link" pendingLabel="Marking...">
            Mark all as read
          </ActionButton>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<Bell className="h-10 w-10 text-on-surface-variant" />}>
          {filter === "unread" ? "You're all caught up — no unread notifications." : "No notifications yet."}
        </EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-md">
            <h2 className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">{group.label}</h2>
            <ul className="flex flex-col gap-md">
              {group.items.map((item) => {
                const known = isKnownType(item.type);
                const Icon = known ? TYPE_ICON[item.type as NotificationType] : Bell;
                const actionUrl = safeActionUrl(item.actionUrl);
                return (
                  <li
                    key={item.id}
                    className={`flex gap-md rounded-xl border p-lg ${
                      item.read
                        ? "border-outline-variant/40 bg-surface-container-lowest"
                        : "border-primary-fixed-dim bg-surface-container-low"
                    }`}
                  >
                    <span
                      className={`mt-sm h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? "bg-outline-variant" : "bg-primary"}`}
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-sm">
                      <div className="flex flex-wrap items-center justify-between gap-sm">
                        <span className="inline-flex items-center gap-xs rounded-md bg-primary-fixed px-sm py-xs font-label-sm text-label-sm text-primary">
                          <Icon className="h-3.5 w-3.5" />
                          {known ? NOTIFICATION_TYPE_LABEL[item.type as NotificationType] : "Notification"}
                        </span>
                        <time
                          dateTime={item.createdAt.toISOString()}
                          title={formatDateTime(item.createdAt)}
                          className="font-label-sm text-label-sm text-on-surface-variant"
                        >
                          {formatRelativeTime(item.createdAt)}
                        </time>
                      </div>
                      <h3 className="font-title-lg text-title-lg text-on-surface">
                        {item.read ? null : <span className="sr-only">Unread: </span>}
                        {item.title}
                      </h3>
                      <p className="whitespace-pre-line font-body-md text-body-md text-on-surface-variant">{item.body}</p>
                      <div className="flex flex-wrap items-center gap-md pt-xs">
                        {actionUrl ? (
                          <Link
                            href={actionUrl}
                            className={
                              item.read
                                ? "inline-flex items-center gap-sm rounded-lg border border-outline-variant px-lg py-sm font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
                                : "inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90"
                            }
                          >
                            {known ? ACTION_LABEL[item.type as NotificationType] : "Open"}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {item.read ? null : (
                          <ActionButton action={markNotificationRead.bind(null, item.id)} variant="link" pendingLabel="Marking...">
                            Mark as read
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
