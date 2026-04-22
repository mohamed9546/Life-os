import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/career/settings";
import { OnboardingForm } from "@/features/settings/onboarding-form";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  const settings = await getUserSettings(user.id, user.email);
  if (settings.profile.onboardingCompleted) {
    redirect("/career");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Welcome"
        subtitle="Set your targets once so Life OS can fetch, rank, and organize the right opportunities."
      />
      <OnboardingForm initialSettings={settings} />
    </div>
  );
}
