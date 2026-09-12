"use server";

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations/auth";

const SIGNUP_FIELD_NAMES = ["name", "email", "password", "confirmPassword"] as const;
type SignupFieldName = (typeof SIGNUP_FIELD_NAMES)[number];

function isSignupFieldName(key: unknown): key is SignupFieldName {
  return typeof key === "string" && (SIGNUP_FIELD_NAMES as readonly string[]).includes(key);
}

export type SignupState = {
  formError?: string;
  fieldErrors?: Partial<Record<SignupFieldName, string>>;
};

export async function signupAction(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: SignupState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (isSignupFieldName(key) && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // Role is a literal here, never read from client input — DECISIONS.md Q15.
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: Role.LEARNER,
    },
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/onboarding",
  });

  return {};
}
