import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { LifeOSDashboard } from "@/features/life-os/life-os-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LifeOSPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Life OS"
        subtitle="Weekly reviews, focus, and life planning"
      />
      <LifeOSDashboard />
    </div>
  );
}
