import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RoutinesDashboard } from "@/features/routines/routines-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Routines"
        subtitle="Turn repeated actions into structured signals the AI can learn from"
      />
      <RoutinesDashboard />
    </div>
  );
}
