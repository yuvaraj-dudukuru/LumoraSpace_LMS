"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { loginSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Generic on purpose — never reveal whether an email exists.
const GENERIC_ERROR = "Invalid email or password";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      setError(GENERIC_ERROR);
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (!result || result.error) {
        setError(GENERIC_ERROR);
        return;
      }
      // Land on "/" and let middleware route to the caller's role home.
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-md">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-headline-md text-headline-md">Sign in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-xs">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-label-sm text-primary underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            {error ? <p className="text-label-sm text-error">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
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
            onClick={() => signIn("google", { redirectTo: "/" })}
          >
            Continue with Google
          </Button>

          <p className="text-center text-label-sm text-on-surface-variant">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
