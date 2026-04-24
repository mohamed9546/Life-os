import { cache } from "react";
import { AuthenticatedAppUser } from "@/types";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, isCareerBetaAdminEmail } from "@/lib/supabase/env";
import { isLocalOnlyMode } from "@/lib/env/local-only";

const PREVIEW_USER: AuthenticatedAppUser = {
  id: process.env.LIFE_OS_DEFAULT_USER_ID || "preview-user",
  email: process.env.LIFE_OS_DEFAULT_USER_EMAIL || "preview@careerbeta.local",
  isAdmin: true,
  mode: "preview",
};

export const getCurrentAppUser = cache(async (): Promise<AuthenticatedAppUser | null> => {
  if (isLocalOnlyMode() || !hasSupabaseEnv()) {
    return PREVIEW_USER;
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return PREVIEW_USER;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || !data.user.email) {
    // No authenticated session — fall back to default owner user
    // so the app is always accessible (single-user personal OS).
    return PREVIEW_USER;
  }

  return {
    id: data.user.id,
    email: data.user.email,
    isAdmin: isCareerBetaAdminEmail(data.user.email),
    mode: "supabase",
  };
});

export async function requireAppUser(): Promise<AuthenticatedAppUser> {
  const user = await getCurrentAppUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdminUser(): Promise<AuthenticatedAppUser> {
  const user = await requireAppUser();
  if (!user.isAdmin) {
    throw new Error("Forbidden");
  }
  return user;
}
