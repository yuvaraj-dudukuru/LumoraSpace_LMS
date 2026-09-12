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
  Layers,
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

// "Settings" here is the shared account-settings surface, not the deferred
// platform-settings IA (DECISIONS.md Q13).
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Programs", href: "/admin/programs", icon: GraduationCap },
  { label: "Batches", href: "/admin/batches", icon: Layers },
  { label: "Enrollments", href: "/admin/enrollments", icon: UserCheck },
  { label: "Mentors", href: "/admin/mentors", icon: Users },
  { label: "Curriculum", href: "/admin/curriculum", icon: BookOpen },
  { label: "Certificates", href: "/admin/certificates", icon: Award },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
