import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { AppShell } from "@/components/shell/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.ADMIN);
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <AppShell
      role="admin"
      userName={user.name}
      topBar={{ searchAction: "/admin/search", notificationsHref: "/admin/notifications", unreadCount }}
    >
      {children}
    </AppShell>
  );
}
