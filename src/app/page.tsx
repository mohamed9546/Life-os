import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/career/settings";
import { SignInCard } from "@/components/sign-in-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentAppUser();

  if (!user) {
    return <SignInCard />;
  }

  const settings = await getUserSettings(user.id, user.email);
  if (!settings.profile.onboardingCompleted) {
    redirect("/welcome");
  }

  redirect("/career");
}
