import Link from "next/link";

// Lightweight public marketing header — not the learner sidebar shell.
// /programs and /programs/[slug] are unauthenticated catalog pages.
export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-container-max items-center justify-between px-margin-mobile lg:px-lg">
          <Link href="/" className="font-headline-md text-title-lg text-on-surface">
            LumoraSpace
          </Link>
          <div className="flex items-center gap-lg">
            <Link href="/login" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container hover:text-on-primary-container"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
