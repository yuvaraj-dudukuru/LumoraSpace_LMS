import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { AppShell } from "@/components/shell/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.ADMIN);

  return (
    <AppShell role="admin" userName={user.name}>
      {children}
    </AppShell>
  );
}
