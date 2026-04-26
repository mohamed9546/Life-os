import { PageHeader } from "@/components/page-header";
import { AITelemetryPanel } from "@/features/settings/ai-telemetry-panel";
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
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Local AI runtime controls, profile preferences, saved searches, and source controls."
      />
      <SettingsPanel isAdmin={user.isAdmin} />
      {user.isAdmin ? <AITelemetryPanel /> : null}
    </div>
  );
}
