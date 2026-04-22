import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { OverviewDashboard } from "@/features/overview/dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="A quick read on your pipeline health, local AI runtime, and source coverage."
      />
      <OverviewDashboard />
    </div>
  );
}
