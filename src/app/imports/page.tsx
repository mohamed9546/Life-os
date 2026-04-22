import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ImportsDashboard } from "@/features/imports/imports-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Imports"
        subtitle="Bring jobs, transactions, and mixed text into the operating system"
      />
      <ImportsDashboard />
    </div>
  );
}
