import Link from "next/link";
import { Workflow, Code2, UserCheck, Rocket, ArrowRight } from "lucide-react";
import { getPublishedPrograms } from "@/lib/queries/programs";
import { PublicHeader } from "@/components/marketing/public-header";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Workflow,
    title: "Structured Programs",
    description:
      "Linear, progressive curricula designed to build foundational understanding before introducing complex abstractions.",
  },
  {
    icon: Code2,
    title: "Hands-on Learning",
    description: "Applied practice through real lessons, quizzes, and graded assignments — not just video.",
  },
  {
    icon: UserCheck,
    title: "Expert Guidance",
    description: "Mentor review on every assignment, with rubric feedback and a clear path to improve.",
  },
  {
    icon: Rocket,
    title: "Career-focused Skills",
    description: "Syllabi built around the tools, patterns, and workflows real engineering teams use.",
  },
] as const;

export default async function LandingPage() {
  const programs = await getPublishedPrograms();
  const featuredPrograms = programs.slice(0, 3);

  return (
    <div className="min-h-screen bg-surface">
      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-container-max grid-cols-1 items-center gap-2xl px-margin-mobile py-3xl lg:grid-cols-2 lg:px-lg lg:py-3xl">
          <div className="flex flex-col items-start gap-lg">
            <span className="flex items-center gap-xs rounded-full bg-surface-container px-md py-xs font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              The Intelligent Learning Environment
            </span>
            <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
              Build Skills.
              <br />
              Build Confidence.
              <br />
              <span className="text-primary">Build Your Career.</span>
            </h1>
            <p className="max-w-lg font-body-lg text-body-lg text-on-surface-variant">
              Master complex technical concepts in an environment engineered for deep work, rigorous
              practice, and measurable progress. Move beyond completion into true capability.
            </p>
            <Link href="/programs" className={buttonVariants({ variant: "default", className: "w-fit" })}>
              Explore Programs
            </Link>
            {/* Real testimonials / learner counts aren't collected yet — see report.
                Intentionally no fabricated numbers, ratings, or avatars here. */}
            <p className="font-label-md text-label-md text-on-surface-variant">
              Join a growing community of learners building real, job-ready skills.
            </p>
          </div>

          <div className="relative hidden aspect-square items-center justify-center lg:flex">
            <div className="absolute inset-8 rounded-3xl bg-gradient-to-br from-primary-container via-secondary-container to-tertiary-container opacity-20" />
            <div className="relative flex w-full max-w-sm flex-col gap-md rounded-3xl border border-outline-variant/30 bg-surface p-xl shadow-lg">
              <div className="flex gap-xs">
                <span className="h-3 w-3 rounded-full bg-error/40" />
                <span className="h-3 w-3 rounded-full bg-warning/40" />
                <span className="h-3 w-3 rounded-full bg-success/40" />
              </div>
              <div className="h-3 w-32 rounded-full bg-surface-container" />
              <div className="h-24 rounded-2xl bg-primary-fixed" />
              <div className="flex gap-sm">
                <div className="h-16 w-16 shrink-0 rounded-xl bg-secondary-fixed" />
                <div className="h-16 flex-1 rounded-xl bg-surface-container" />
              </div>
            </div>
          </div>
        </section>

        {/* Featured programs — real PUBLISHED programs */}
        <section className="mx-auto max-w-container-max px-margin-mobile py-2xl lg:px-lg">
          <div className="mb-lg flex items-end justify-between gap-md">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Featured Programs</h2>
            <Link
              href="/programs"
              className="flex shrink-0 items-center gap-xs font-label-md text-label-md text-primary hover:underline"
            >
              View all programs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featuredPrograms.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
              <p className="font-body-md text-body-md text-on-surface-variant">
                No programs are open for enrollment right now — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-xl md:grid-cols-3">
              {featuredPrograms.map((program) => (
                <Link
                  key={program.id}
                  href={`/programs/${program.slug}`}
                  className="flex h-full flex-col rounded-xl bg-surface-container-low p-lg shadow-sm transition-all hover:shadow-md"
                >
                  <span className="mb-sm font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                    {program.level}
                  </span>
                  <h3 className="font-headline-md text-headline-md text-on-surface">{program.name}</h3>
                  <p className="mt-sm flex-grow font-body-md text-body-md text-on-surface-variant line-clamp-3">
                    {program.description}
                  </p>
                  <div className="mt-lg flex items-center gap-lg border-t border-outline-variant/30 pt-md">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Duration</span>
                      <span className="font-label-md text-label-md text-on-surface">
                        {program.durationWeeks} Weeks
                      </span>
                    </div>
                    {program.credentialType ? (
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                          Credential
                        </span>
                        <span className="font-label-md text-label-md text-on-surface">
                          {program.credentialType}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Why LumoraSpace — static marketing copy */}
        <section className="mx-auto max-w-container-max px-margin-mobile py-2xl lg:px-lg">
          <div className="max-w-2xl">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Built for learners who want more than completion.
            </h2>
            <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
              We optimize for capability, not just certificates. Our methodology is grounded in
              cognitive science and practical engineering principles.
            </p>
          </div>

          <div className="mt-xl grid grid-cols-1 gap-lg sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-lg">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="font-title-lg text-title-lg text-on-surface">{feature.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 bg-surface-container-low py-2xl">
        <div className="mx-auto flex max-w-container-max flex-col items-start justify-between gap-lg px-margin-mobile lg:flex-row lg:items-center lg:px-lg">
          <div className="flex flex-col gap-xs">
            <span className="font-headline-md text-title-lg text-on-surface">LumoraSpace</span>
            <p className="max-w-xs font-body-md text-body-md text-on-surface-variant">
              The premier technical learning environment for those who seek intellectual rigor and
              mastery.
            </p>
          </div>
          <div className="flex items-center gap-lg font-label-md text-label-md text-on-surface-variant">
            <Link href="/programs" className="hover:text-on-surface">
              Programs
            </Link>
            <Link href="/login" className="hover:text-on-surface">
              Login
            </Link>
            <Link href="/signup" className="hover:text-on-surface">
              Sign Up
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-xl max-w-container-max border-t border-outline-variant/30 px-margin-mobile pt-lg font-label-sm text-label-sm text-on-surface-variant lg:px-lg">
          © {new Date().getFullYear()} LumoraSpace. Engineered for Depth.
        </div>
      </footer>
    </div>
  );
}
