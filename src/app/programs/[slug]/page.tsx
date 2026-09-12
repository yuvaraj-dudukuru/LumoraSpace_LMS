import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { getProgramForCatalog, getEnrollableBatches } from "@/lib/queries/programs";
import { CurriculumAccordion } from "@/components/curriculum/curriculum-accordion";
import { buttonVariants } from "@/components/ui/button";
import { EnrollForm } from "./enroll-form";

export default async function ProgramDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await getProgramForCatalog(slug);
  if (!program) notFound();

  const [batches, session] = await Promise.all([getEnrollableBatches(program.id), auth()]);

  const modules = program.modules.map((programModule) => ({
    id: programModule.id,
    title: programModule.title,
    description: programModule.description,
    order: programModule.order,
    lessons: programModule.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      type: lesson.type,
    })),
  }));

  const role = session?.user?.role;

  return (
    <div>
      <section className="mx-auto max-w-container-max px-margin-mobile py-3xl lg:px-lg">
        <div className="grid grid-cols-1 items-center gap-2xl lg:grid-cols-2">
          <div className="flex flex-col gap-lg">
            {program.credentialType ? (
              <span className="font-label-sm uppercase tracking-widest text-primary">
                {program.credentialType}
              </span>
            ) : null}
            <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
              {program.name}
            </h1>
            <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
              {program.description}
            </p>
            <div className="flex flex-col gap-md sm:flex-row">
              <a
                href="#enroll"
                className={buttonVariants({ variant: "default", className: "justify-center" })}
              >
                Enroll Now
              </a>
              <a
                href="#curriculum"
                className={buttonVariants({ variant: "outline", className: "justify-center" })}
              >
                Explore Curriculum
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container py-xl">
        <div className="mx-auto grid max-w-container-max grid-cols-2 gap-xl px-margin-mobile md:grid-cols-4 lg:px-lg">
          <Stat label="Duration" value={`${program.durationWeeks} Weeks`} />
          <Stat label="Level" value={program.level} />
          <Stat label="Format" value={program.format} />
          <Stat label="Price" value={program.price ? `$${program.price}` : "Contact us"} />
        </div>
      </section>

      {program.outcomes.length > 0 ? (
        <section className="mx-auto max-w-container-max px-margin-mobile py-3xl lg:px-lg">
          <h2 className="mb-lg font-headline-lg text-headline-lg text-on-surface">What You&apos;ll Learn</h2>
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
            {program.outcomes.map((outcome) => (
              <div key={outcome.id} className="rounded-xl border border-outline-variant/30 bg-surface p-lg">
                <h3 className="font-title-lg text-title-lg text-on-surface">{outcome.title}</h3>
                <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                  {outcome.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="curriculum" className="mx-auto max-w-container-max px-margin-mobile py-3xl lg:px-lg">
        <h2 className="mb-lg font-headline-lg text-headline-lg text-on-surface">Curriculum Structure</h2>
        {modules.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Curriculum details are coming soon.
          </p>
        ) : (
          <CurriculumAccordion modules={modules} mode="catalog" />
        )}
      </section>

      <section id="enroll" className="mx-auto max-w-container-max px-margin-mobile py-3xl lg:px-lg">
        <div className="rounded-2xl bg-surface-container-low p-xl">
          <h2 className="mb-md font-headline-md text-headline-md text-on-surface">Enroll in this program</h2>
          {!session?.user ? (
            <div className="flex flex-col gap-md">
              <p className="font-body-md text-body-md text-on-surface-variant">
                Sign in to enroll in a cohort for this program.
              </p>
              <Link
                href={`/login?returnTo=${encodeURIComponent(`/programs/${slug}`)}`}
                className={buttonVariants({ variant: "default", className: "w-fit" })}
              >
                Log in to Enroll
              </Link>
            </div>
          ) : role === Role.LEARNER ? (
            <EnrollForm programId={program.id} batches={batches} />
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant">
              Enrollment is only available for learner accounts.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="font-title-lg text-title-lg text-on-surface">{value}</span>
    </div>
  );
}
