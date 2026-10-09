import type { LucideIcon } from "lucide-react";
import {
  Home,
  GraduationCap,
  LineChart,
  Settings,
  LayoutDashboard,
  Users,
  ClipboardCheck,
  UserCheck,
  Award,
  Target,
  Banknote,
  Layers,
  Contact,
  BookOpen,
  FileQuestion,
  ChartColumn,
  Bell,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Opens in a new tab (rel="noopener noreferrer") and is never marked
   * active. Only AppShell adds such an item, from a server-validated URL. */
  external?: boolean;
  /** Draws a rule above this item (the Stitch sidebars split off the last group). */
  dividerBefore?: boolean;
};

// MVP-pruned per design/stitch/{student_dashboard_home,mentor_dashboard_desktop,
// admin_dashboard_desktop} sidebars, cross-referenced against DATA_MODEL.md's
// // PHASE 2 markers and API.md. Omitted everywhere: Practice, Community,
// Notifications, Sessions, Resources, Analytics, admin Assessment CRUD — all
// Phase 2 or explicitly deferred (DECISIONS.md).
export const LEARNER_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/learn", icon: Home },
  { label: "My Learning", href: "/learn/my-learning", icon: GraduationCap },
  // Phase A — PUBLISHED kind=PRACTICE assessments across GRANTED enrollments.
  { label: "Practice", href: "/learn/practice", icon: Target },
  { label: "Progress", href: "/learn/progress", icon: LineChart },
  { label: "Notifications", href: "/learn/notifications", icon: Bell },
  { label: "Settings", href: "/learn/settings", icon: Settings },
];

// "Submissions", not "Reviews" — DECISIONS.md Q5. "Profile" folded into
// Settings — both are the same ANY-role account-settings surface (Q9).
// "Courses" (API.md's documented GET /mentor/programs, Stitch:
// courses_lumoraspace/course_detail_forge_data_analyst) was never built —
// removed rather than left pointing at a 404, same call as ADMIN_NAV_ITEMS
// below: a dead nav item is worse than an absent one.
export const MENTOR_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/mentor", icon: LayoutDashboard },
  { label: "Learners", href: "/mentor/learners", icon: Users },
  { label: "Submissions", href: "/mentor/submissions", icon: ClipboardCheck },
  { label: "Settings", href: "/mentor/settings", icon: Settings },
];

// Every item has a real page behind it. Settings is the one admin section
// from the Stitch sidebar still not built (DECISIONS.md #13) — left out
// rather than left pointing at a 404.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Programs", href: "/admin/programs", icon: GraduationCap },
  { label: "Batches", href: "/admin/batches", icon: Layers },
  { label: "Enrollments", href: "/admin/enrollments", icon: UserCheck },
  { label: "Mentors", href: "/admin/mentors", icon: Contact },
  { label: "Curriculum", href: "/admin/curriculum", icon: BookOpen },
  { label: "Assessments", href: "/admin/assessments", icon: FileQuestion },
  { label: "Certificates", href: "/admin/certificates", icon: Award },
  { label: "Analytics", href: "/admin/analytics", icon: ChartColumn },
  // Records only — the gateway is still stubbed (PRODUCTION_ROADMAP.md Phase H).
  { label: "Payments", href: "/admin/payments", icon: Banknote },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, dividerBefore: true },
];