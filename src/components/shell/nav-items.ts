import type { LucideIcon } from "lucide-react";
import {
  Home,
  GraduationCap,
  LineChart,
  Settings,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  UserCheck,
  Award,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// MVP-pruned per design/stitch/{student_dashboard_home,mentor_dashboard_desktop,
// admin_dashboard_desktop} sidebars, cross-referenced against DATA_MODEL.md's
// // PHASE 2 markers and API.md. Omitted everywhere: Practice, Community,
// Notifications, Sessions, Resources, Analytics, Payments, admin Assessment
// CRUD — all Phase 2 or explicitly deferred (DECISIONS.md).
export const LEARNER_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/learn", icon: Home },
  { label: "My Learning", href: "/learn/my-learning", icon: GraduationCap },
  { label: "Progress", href: "/learn/progress", icon: LineChart },
  { label: "Settings", href: "/learn/settings", icon: Settings },
];

// "Submissions", not "Reviews" — DECISIONS.md Q5. "Profile" folded into
// Settings — both are the same ANY-role account-settings surface (Q9).
export const MENTOR_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/mentor", icon: LayoutDashboard },
  { label: "Learners", href: "/mentor/learners", icon: Users },
  { label: "Courses", href: "/mentor/courses", icon: BookOpen },
  { label: "Submissions", href: "/mentor/submissions", icon: ClipboardCheck },
  { label: "Settings", href: "/mentor/settings", icon: Settings },
];

// M5c — trimmed to only the routes that actually exist. Programs, Batches,
// Mentors (the standalone directory), Curriculum, and Settings all 404'd —
// a dead nav item is worse than an absent one. Content authoring for
// programs/modules/lessons/assessments/assignments stays seed-only for now
// (M5c is deliberately narrow); mentor assignment moved into
// /admin/users/[userId] instead of a standalone directory.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Enrollments", href: "/admin/enrollments", icon: UserCheck },
  { label: "Certificates", href: "/admin/certificates", icon: Award },
];
