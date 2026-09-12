import Link from "next/link";
import { getPublishedPrograms } from "@/lib/queries/programs";

export default async function ProgramsPage() {
  const programs = await getPublishedPrograms();

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile pb-3xl pt-3xl lg:px-lg">
      <div className="max-w-3xl">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Programs built for your next step.
        </h1>
        <p className="mt-md font-body-lg text-body-lg text-on-surface-variant">
          Master practical skills with rigorous, cohort-based curriculums designed to elevate your
          technical capability and career readiness.
        </p>
      </div>

      {programs.length === 0 ? (
        <div className="mt-2xl rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            No programs are open for enrollment right now — check back soon.
          </p>
        </div>
      ) : (
        <div className="mt-2xl grid grid-cols-1 gap-xl md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={`/programs/${program.slug}`}
              className="flex h-full flex-col rounded-xl bg-surface p-lg shadow-sm transition-all hover:shadow-md"
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
                  <span className="font-label-md text-label-md text-on-surface">{program.durationWeeks} Weeks</span>
                </div>
                {program.credentialType ? (
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Credential</span>
                    <span className="font-label-md text-label-md text-on-surface">{program.credentialType}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
