import { PageHeader } from "@/components/page-header";
import { CareerDashboard } from "@/features/career/career-dashboard";
import { getCurrentAppUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CareerPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return (
    <div>
      <PageHeader
        title="Career"
        subtitle="Broader source coverage, AI ranking, and contact-first job strategy."
      />
      <CareerDashboard />
    </div>
  );
}
