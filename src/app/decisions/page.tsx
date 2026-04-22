import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DecisionsDashboard } from "@/features/decisions/decisions-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Decisions"
        subtitle="AI-assisted decision analysis and tracking"
      />
      <DecisionsDashboard />
    </div>
  );
}
