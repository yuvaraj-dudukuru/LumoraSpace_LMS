import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getProfileForSettings } from "@/lib/queries/settings";
import { SettingsView } from "@/components/settings/settings-view";

export default async function LearnSettingsPage() {
  const user = await requireUser();
  const profile = await getProfileForSettings(user.id);
  if (!profile) notFound();

  return <SettingsView profile={profile} />;
}
