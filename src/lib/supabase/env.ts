export function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || null;
}

export function getSupabasePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || null;
}

export function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getCareerBetaAdminEmails(): string[] {
  return (process.env.CAREER_BETA_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isCareerBetaAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getCareerBetaAdminEmails().includes(email.toLowerCase());
}
