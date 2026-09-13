import { PublicHeader } from "@/components/marketing/public-header";

// Lightweight public marketing header — not the learner sidebar shell.
// /programs and /programs/[slug] are unauthenticated catalog pages.
export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <PublicHeader />
      <main>{children}</main>
    </div>
  );
}
