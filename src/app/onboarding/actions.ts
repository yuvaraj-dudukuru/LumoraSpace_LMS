"use server";

import { ExperienceLevel, Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

// Both fields are optional here (not in the domain model) — "Skip for now"
// on the welcome/goal screens completes onboarding without recording them.
const onboardingSchema = z.object({
  learningGoal: z.string().min(1).max(64).optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OnboardingResult = { ok: true } | { ok: false; error: string };

// DECISIONS.md Q22 — personalization only. Never creates an Enrollment.
export async function completeOnboardingAction(input: OnboardingInput): Promise<OnboardingResult> {
  const user = await requireRole(Role.LEARNER);

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.learningGoal ? { learningGoal: parsed.data.learningGoal } : {}),
      ...(parsed.data.experienceLevel ? { experienceLevel: parsed.data.experienceLevel } : {}),
      onboardingComplete: true,
    },
  });

  return { ok: true };
}
