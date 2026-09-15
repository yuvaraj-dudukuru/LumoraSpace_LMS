import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getProfileForSettings } from "@/lib/queries/settings";
import { SettingsView } from "@/components/settings/settings-view";

// Same ANY-role account-settings surface as /learn/settings (DECISIONS.md
// Q9) — shared SettingsView, just mounted under the mentor shell too.
export default async function MentorSettingsPage() {
  const user = await requireUser();
  const profile = await getProfileForSettings(user.id);
  if (!profile) notFound();

  return <SettingsView profile={profile} />;
}
