import { PageHeader } from "@/components/page-header";
import { SettingsPanel } from "@/features/settings/settings-panel";
import { getCurrentAppUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Local AI runtime controls, profile preferences, saved searches, and source controls."
      />
      <SettingsPanel isAdmin={user.isAdmin} />
    </div>
  );
}
