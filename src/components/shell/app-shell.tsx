"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/sign-out";
import { LEARNER_NAV_ITEMS, MENTOR_NAV_ITEMS, ADMIN_NAV_ITEMS } from "./nav-items";

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
  children: React.ReactNode;
};

export function AppShell({ role, userName, children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navItems = NAV_ITEMS_BY_ROLE[role];
  const roleLabel = ROLE_LABEL[role];

  function renderNav(onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-xs px-md">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-md rounded-lg px-md py-sm font-label-md text-label-md transition-colors ${
                active
                  ? "bg-primary-container text-on-primary-container font-medium"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface/80 px-md backdrop-blur-xl md:justify-end">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-label-md text-label-md text-on-surface md:hidden">{userName}</span>
        </header>
        <main className="p-xl">{children}</main>
      </div>
    </div>
  );
}
