"use client"; // local input state, a pending transition, and an inline server result

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetUserPassword } from "../actions";

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await resetUserPassword(userId, newPassword);
      if (result.ok) {
        setNewPassword("");
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-sm">
      <div className="flex flex-col gap-xs">
        <Label htmlFor="admin-reset-password">New password</Label>
        <Input
          id="admin-reset-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        Share the new password with the user directly — it isn&apos;t emailed, and you won&apos;t see it again.
      </p>
      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
      {done ? <p className="font-label-sm text-label-sm text-success">Password updated.</p> : null}
      <Button type="submit" variant="outline" disabled={isPending || newPassword.length < 8} className="w-fit">
        {isPending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
