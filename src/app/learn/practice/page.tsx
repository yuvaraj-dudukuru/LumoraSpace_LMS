import Link from "next/link";
import { Target, Clock, RotateCcw } from "lucide-react";
import { AccessState } from "@prisma/client";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getPracticeAssessments, type PracticeAssessmentItem } from "@/lib/queries/practice";
import { buttonVariants } from "@/components/ui/button";

function actionLabel(item: PracticeAssessmentItem): string {
  if (item.inProgress) return "Resume";
  return item.attemptsUsed > 0 ? "Try again" : "Start";
}

export default async function PracticePage() {
  const user = await requireUser();

  // Two queries, one wave: the practice list and whether the learner has any
  // content access at all (so "no practice yet" and "not enrolled" differ).
  const [groups, grantedEnrollmentCount] = await Promise.all([
    getPracticeAssessments(user.id),
    prisma.enrollment.count({ where: { userId: user.id, accessState: AccessState.GRANTED } }),
  ]);

  if (grantedEnrollmentCount === 0) {
    return (
      <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
        <Target className="h-12 w-12 text-on-surface-variant" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Practice</h1>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Practice assessments unlock once you have access to a program. Browse the catalog to find your next cohort.
        </p>
        <Link href="/programs" className={buttonVariants({ variant: "default" })}>
          Browse Programs
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2xl pb-2xl">
      <header>
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Practice
        </h1>
        <p className="mt-sm font-body-lg text-body-lg text-on-surface-variant">
          Practice assessments from your programs. They don&apos;t count toward your certificate — take them as often as they allow.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
          <Target className="h-12 w-12 text-on-surface-variant" />
          <h2 className="font-headline-md text-headline-md text-on-surface">No practice assessments yet</h2>
          <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
            None of your programs has a published practice assessment. Graded assessments live in their lessons.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-xl">
          {groups.map((program) => (
            <section key={program.programId} className="flex flex-col gap-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">{program.programName}</h2>
              {program.modules.map((programModule) => (
                <div key={programModule.moduleId} className="flex flex-col gap-sm">
                  <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                    {programModule.moduleTitle}
                  </h3>
                  <ul className="flex flex-col gap-sm">
                    {programModule.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-col gap-xs">
                          <span className="font-label-md text-label-md text-on-surface">{item.title}</span>
                          <span className="flex flex-wrap items-center gap-md font-label-sm text-label-sm text-on-surface-variant">
                            <span className="flex items-center gap-xs">
                              <RotateCcw className="h-3.5 w-3.5" />
                              {item.allowedAttempts === 0
                                ? `${item.attemptsUsed} attempt${item.attemptsUsed === 1 ? "" : "s"} taken`
                                : `${item.attemptsUsed} / ${item.allowedAttempts} attempts`}
                            </span>
                            {item.timeLimitMins !== null ? (
                              <span className="flex items-center gap-xs">
                                <Clock className="h-3.5 w-3.5" />
                                {item.timeLimitMins} min limit
                              </span>
                            ) : null}
                            <span>{item.bestScorePercent !== null ? `Best score ${item.bestScorePercent}%` : "Not attempted"}</span>
                          </span>
                        </div>
                        {item.attemptsExhausted ? (
                          <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">No attempts left</span>
                        ) : (
                          <Link
                            href={item.href}
                            className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit shrink-0" })}
                          >
                            {actionLabel(item)}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
