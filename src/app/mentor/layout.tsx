import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { AppShell } from "@/components/shell/app-shell";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.MENTOR, Role.ADMIN);

  return (
    <AppShell role="mentor" userName={user.name}>
      {children}
    </AppShell>
  );
}
