"use client"; // open/closed toggle + pending submit state

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { createUser } from "./actions";

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MENTOR");

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createUser({ name, email, password, role });
      if (result.ok) {
        setOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("MENTOR");
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-sm rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" /> Add User
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-md rounded-xl border border-outline-variant/40 bg-surface-container-low p-lg"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-title-lg text-title-lg text-on-surface">Add User</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close">
          <X className="h-4 w-4 text-on-surface-variant" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="MENTOR">Mentor</option>
          <option value="ADMIN">Admin</option>
          <option value="LEARNER">Learner</option>
        </select>
      </div>

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Account"}
        </button>
      </div>
    </form>
  );
}
