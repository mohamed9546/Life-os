import { PageHeader } from "@/components/page-header";
import { AutomationDashboard } from "@/features/automation/automation-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  if (!user.isAdmin) {
    redirect("/career");
  }

  return (
    <div>
      <PageHeader
        title="Automation"
        subtitle="Internal operations for local worker tasks, source health, and the AI runtime."
      />
      <AutomationDashboard />
    </div>
  );
}
