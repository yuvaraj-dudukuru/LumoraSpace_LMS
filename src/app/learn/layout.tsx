import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { AppShell } from "@/components/shell/app-shell";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.LEARNER, Role.ADMIN);

  return (
    <AppShell role="learner" userName={user.name}>
      {children}
    </AppShell>
  );
}
