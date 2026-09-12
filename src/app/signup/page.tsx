"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signupAction, type SignupState } from "./actions";

const initialState: SignupState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-md">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-headline-md text-headline-md">Create your account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-lg">
          <form action={formAction} className="flex flex-col gap-md" noValidate>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" type="text" placeholder="Jane Doe" autoComplete="name" required />
              {state.fieldErrors?.name ? (
                <p className="text-label-sm text-error">{state.fieldErrors.name}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@example.com"
                autoComplete="email"
                required
              />
              {state.fieldErrors?.email ? (
                <p className="text-label-sm text-error">{state.fieldErrors.email}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {state.fieldErrors?.password ? (
                <p className="text-label-sm text-error">{state.fieldErrors.password}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {state.fieldErrors?.confirmPassword ? (
                <p className="text-label-sm text-error">{state.fieldErrors.confirmPassword}</p>
              ) : null}
            </div>
            {state.formError ? <p className="text-label-sm text-error">{state.formError}</p> : null}
            <SubmitButton />
          </form>

          <div className="flex items-center gap-sm text-label-sm text-on-surface-variant">
            <div className="h-px flex-1 bg-outline-variant" />
            or
            <div className="h-px flex-1 bg-outline-variant" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn("google", { redirectTo: "/onboarding" })}
          >
            Continue with Google
          </Button>

          <p className="text-center text-label-sm text-on-surface-variant">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="text-primary underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="text-center text-label-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
