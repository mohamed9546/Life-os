import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "./env";

let warnedMissingServiceRole = false;

export function createServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    if (url && !key && !warnedMissingServiceRole) {
      warnedMissingServiceRole = true;
      console.warn(
        "[supabase/service] SUPABASE_SERVICE_ROLE_KEY is not configured; using local JSON storage for server writes."
      );
    }
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
