import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { AppShell } from "@/components/shell/app-shell";

/** COMMUNITY_URL, only when it is an absolute http(s) URL. Read here, on
 * the server, and handed to the client shell as a plain string — the env
 * var itself never reaches the client. Unset or malformed = no nav item. */
function resolveCommunityUrl(): string | undefined {
  const raw = process.env.COMMUNITY_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
}

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.LEARNER, Role.ADMIN);

  return (
    <AppShell role="learner" userName={user.name} communityUrl={resolveCommunityUrl()}>
      {children}
    </AppShell>
  );
}
