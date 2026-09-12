"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ExperienceLevel } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { completeOnboardingAction } from "./actions";

const GOAL_OPTIONS: { key: string; label: string }[] = [
  { key: "build-skills", label: "Build job-ready skills" },
  { key: "career-switch", label: "Switch careers" },
  { key: "improve-skills", label: "Improve my current skills" },
  { key: "build-projects", label: "Build practical projects" },
  { key: "explore-tech", label: "Explore a new technology" },
];

const EXPERIENCE_OPTIONS: { key: ExperienceLevel; label: string }[] = [
  { key: ExperienceLevel.BEGINNER, label: "Beginner" },
  { key: ExperienceLevel.SOME_EXPERIENCE, label: "Some experience" },
  { key: ExperienceLevel.INTERMEDIATE, label: "Intermediate" },
  { key: ExperienceLevel.ADVANCED, label: "Advanced" },
];

type Step = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [goal, setGoal] = useState<string | undefined>(undefined);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  function finish(payload: { learningGoal?: string; experienceLevel?: ExperienceLevel }) {
    startTransition(async () => {
      const result = await completeOnboardingAction(payload);
      if (result.ok) {
        await update({ onboardingComplete: true });
        setStep(3);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-md">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col gap-xl p-xl">
          {step < 3 ? (
            <p className="font-label-sm text-label-sm text-on-surface-variant">Step {step + 1} of 3</p>
          ) : null}

          {step === 0 ? (
            <div className="flex flex-col gap-lg">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Welcome, {firstName}</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Let&apos;s personalize your experience — this takes about 2 minutes.
              </p>
              <div className="flex gap-md">
                <Button variant="outline" onClick={() => finish({})} disabled={isPending}>
                  Skip for now
                </Button>
                <Button onClick={() => setStep(1)}>Continue</Button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-lg">
              <h1 className="font-headline-md text-headline-md text-on-surface">What&apos;s your goal?</h1>
              <div className="flex flex-col gap-sm">
                {GOAL_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setGoal(option.key)}
                    className={`rounded-lg border px-md py-sm text-left font-body-md text-body-md transition-colors ${
                      goal === option.key
                        ? "border-primary bg-primary-container text-on-primary-container"
                        : "border-outline-variant text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-md">
                <Button variant="outline" onClick={() => finish({})} disabled={isPending}>
                  Skip for now
                </Button>
                <Button onClick={() => setStep(2)} disabled={!goal}>
                  Continue
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-lg">
              <h1 className="font-headline-md text-headline-md text-on-surface">What&apos;s your experience level?</h1>
              <div className="flex flex-col gap-sm">
                {EXPERIENCE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setExperienceLevel(option.key)}
                    className={`rounded-lg border px-md py-sm text-left font-body-md text-body-md transition-colors ${
                      experienceLevel === option.key
                        ? "border-primary bg-primary-container text-on-primary-container"
                        : "border-outline-variant text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-md">
                <Button
                  variant="outline"
                  onClick={() => finish({ learningGoal: goal })}
                  disabled={isPending}
                >
                  Skip for now
                </Button>
                <Button
                  onClick={() => finish({ learningGoal: goal, experienceLevel })}
                  disabled={!experienceLevel || isPending}
                >
                  {isPending ? "Saving…" : "Complete setup"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col items-center gap-lg text-center">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">You&apos;re all set!</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Browse our programs to find the right cohort for you.
              </p>
              <Link
                href="/programs"
                onClick={() => router.refresh()}
                className={buttonVariants({ variant: "default" })}
              >
                Browse Programs
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
