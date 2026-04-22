import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "./env";

export function createServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey() || getSupabasePublishableKey();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
