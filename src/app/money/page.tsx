import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MoneyDashboard } from "@/features/money/money-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Money"
        subtitle="AI-powered transaction categorization and spending insights"
      />
      <MoneyDashboard />
    </div>
  );
}
