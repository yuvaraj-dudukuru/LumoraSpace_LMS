"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Users, ExternalLink, Bell, Search } from "lucide-react";
import { signOutAction } from "@/lib/actions/sign-out";
import { LEARNER_NAV_ITEMS, MENTOR_NAV_ITEMS, ADMIN_NAV_ITEMS, type NavItem } from "./nav-items";

// Icon components can't cross the Server->Client prop boundary (they're
// functions, not serializable), so this Client Component imports the nav
// arrays itself and only takes a plain-string `role` prop from the layout.
type ShellRole = "learner" | "mentor" | "admin";

const NAV_ITEMS_BY_ROLE = {
  learner: LEARNER_NAV_ITEMS,
  mentor: MENTOR_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
} as const;

const ROLE_LABEL: Record<ShellRole, string> = {
  learner: "Learner",
  mentor: "Mentor",
  admin: "Admin",
};

type AppShellProps = {
  role: ShellRole;
  userName: string;
  /** Phase A — an absolute http(s) URL already validated by the server
   * layout from COMMUNITY_URL; when present the learner nav gains a
   * "Community" item that opens it in a new tab. Plain string only: icon
   * components can't cross the server→client boundary. */
  communityUrl?: string;
  /** Admin only (admin_dashboard_desktop top bar): a search box that submits
   * to `searchAction?q=…`, and a bell linking to the inbox with the unread
   * count the server layout already fetched. */
  topBar?: { searchAction: string; notificationsHref: string; unreadCount: number };
  children: React.ReactNode;
};

export function AppShell({ role, userName, communityUrl, topBar, children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navItems: NavItem[] =
    role === "learner" && communityUrl
      ? [...NAV_ITEMS_BY_ROLE[role], { label: "Community", href: communityUrl, icon: Users, external: true }]
      : [...NAV_ITEMS_BY_ROLE[role]];
  const roleLabel = ROLE_LABEL[role];
  // Longest matching href wins, so the section root ("/admin") isn't also
  // marked active on every page beneath it ("/admin/payments").
  const activeHref = navItems
    .filter((item) => !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .reduce<string | null>((best, item) => (best === null || item.href.length > best.length ? item.href : best), null);

  function renderNav(onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-xs overflow-y-auto px-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onNavigate}
                className="flex items-center gap-md rounded-lg px-md py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <Icon className="h-5 w-5" />
                {item.label}
                <ExternalLink className="ml-auto h-4 w-4" aria-hidden="true" />
              </a>
            );
          }
          const active = item.href === activeHref;
          const unread = topBar && item.href === topBar.notificationsHref ? topBar.unreadCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-md rounded-lg px-md py-sm font-label-md text-label-md transition-colors ${
                item.dividerBefore ? "mt-lg" : ""
              } ${
                active
                  ? "bg-primary-container text-on-primary-container font-medium"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
              {unread > 0 ? (
                <span className="ml-auto rounded-full bg-error px-sm font-label-sm text-label-sm text-on-error">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-outline-variant bg-surface-container-lowest py-lg md:flex">
        <div className="px-md pb-lg">
          <span className="font-headline-md text-headline-md text-primary">LumoraSpace</span>
        </div>
        {renderNav()}
        <div className="mx-md mt-auto flex items-center gap-md rounded-xl bg-surface-container-highest/40 p-md">
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate font-label-md text-label-md text-on-surface">{userName}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOutAction();
            }}
            aria-label="Log out"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface-container-lowest py-lg">
            <div className="flex items-center justify-between px-md pb-lg">
              <span className="font-headline-md text-headline-md text-primary">LumoraSpace</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav(() => setDrawerOpen(false))}
          </aside>
        </div>
      ) : null}

      <div className="md:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-md border-b border-outline-variant bg-surface/80 px-md backdrop-blur-xl md:justify-end md:px-xl">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          {topBar ? (
            <>
              <form method="GET" action={topBar.searchAction} role="search" className="min-w-0 flex-1 md:mr-auto md:max-w-xl">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="search"
                    name="q"
                    placeholder="Search users, programs, batches..."
                    aria-label="Search users, programs and batches"
                    className="w-full rounded-full bg-surface-container py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </form>
              <Link
                href={topBar.notificationsHref}
                aria-label={topBar.unreadCount > 0 ? `Notifications, ${topBar.unreadCount} unread` : "Notifications"}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <Bell className="h-5 w-5" />
                {topBar.unreadCount > 0 ? (
                  <span
                    className="absolute right-sm top-sm h-2.5 w-2.5 rounded-full border-2 border-surface bg-error"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            </>
          ) : (
            <span className="font-label-md text-label-md text-on-surface md:hidden">{userName}</span>
          )}
        </header>
        <main className="p-xl">{children}</main>
      </div>
    </div>
  );
}
