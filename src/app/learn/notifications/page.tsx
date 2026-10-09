import { requireUser } from "@/lib/auth-guards";
import { getNotificationsForUser, getUnreadNotificationCount, type NotificationFilter } from "@/lib/queries/notifications";
import { NotificationInbox } from "@/components/notifications/notification-inbox";

export default async function LearnerNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const filter: NotificationFilter = (await searchParams).filter === "unread" ? "unread" : "all";

  const [items, unreadCount] = await Promise.all([
    getNotificationsForUser(user.id, filter),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <div className="flex flex-col gap-xl pb-2xl">
      <header className="flex flex-col gap-sm border-b border-outline-variant/40 pb-lg">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Notifications
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Stay updated on your learning activity and curriculum progress.
        </p>
      </header>
      <NotificationInbox items={items} filter={filter} basePath="/learn/notifications" unreadCount={unreadCount} />
    </div>
  );
}
