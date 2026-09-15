"use client";

import { useState, useTransition } from "react";
import { updateProfile, changePassword } from "@/app/learn/settings/actions";
import type { SettingsProfile } from "@/lib/queries/settings";

const inputClass =
  "rounded-lg border border-outline-variant bg-surface px-md py-sm font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function ProfileCard({ profile }: { profile: SettingsProfile }) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile({ name, bio });
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-low p-xl"
    >
      <div>
        <h2 className="font-title-lg text-title-lg text-on-surface">Profile</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Your name and bio are visible to mentors and admins.
        </p>
      </div>

      <div className="flex flex-col gap-sm">
        <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="settings-name">
          Full name
        </label>
        <input
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-sm">
        <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="settings-email">
          Email address
        </label>
        <input id="settings-email" type="email" value={profile.email} disabled className={inputClass} />
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Your email is your sign-in identity and can&apos;t be changed here.
        </p>
      </div>

      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="settings-bio">
            Bio
          </label>
          <span className="font-label-sm text-label-sm text-on-surface-variant">{bio.length}/500</span>
        </div>
        <textarea
          id="settings-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Tell mentors a little about yourself..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
      {saved ? <p className="font-label-sm text-label-sm text-primary">Profile updated.</p> : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function SecurityCard({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await changePassword({ currentPassword, newPassword, confirmNewPassword });
      if (result.ok) {
        setSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-low p-xl">
      <div>
        <h2 className="font-title-lg text-title-lg text-on-surface">Security</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Change your account password.</p>
      </div>

      {!hasPassword ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Your account signs in with Google — there&apos;s no password to change here.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="flex flex-col gap-sm">
            <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="settings-current-password">
              Current password
            </label>
            <input
              id="settings-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <div className="flex flex-col gap-sm">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="settings-new-password">
                New password
              </label>
              <input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-sm">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="settings-confirm-password">
                Confirm new password
              </label>
              <input
                id="settings-confirm-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Must be at least 8 characters.</p>

          {error ? <p className="font-label-sm text-label-sm text-error">{error}</p> : null}
          {saved ? <p className="font-label-sm text-label-sm text-primary">Password changed.</p> : null}

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SettingsView({ profile }: { profile: SettingsProfile }) {
  return (
    <div className="flex flex-col gap-2xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Settings
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Manage your profile and account security.
        </p>
      </header>

      <div className="flex max-w-2xl flex-col gap-xl">
        <ProfileCard profile={profile} />
        <SecurityCard hasPassword={profile.hasPassword} />
      </div>
    </div>
  );
}
