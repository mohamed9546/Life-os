import { NextResponse } from "next/server";
import { getSupabaseUrl, getSupabasePublishableKey, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = getSupabaseUrl();
  const pubKey = getSupabasePublishableKey();
  const serviceKey = getSupabaseServiceRoleKey();
  
  let dbCheck = "not attempted";
  let dbError = null;
  let dbResult = null;

  try {
    const supabase = createServiceClient();
    if (supabase) {
      dbCheck = "attempting connection...";
      const { data, error } = await supabase.from("storage_kv").select("key").limit(1);
      if (error) {
        dbCheck = "failed";
        dbError = error;
      } else {
        dbCheck = "success";
        dbResult = data;
      }
    } else {
      dbCheck = "client creation failed (missing keys)";
    }
  } catch (err: any) {
    dbCheck = "exception thrown";
    dbError = err.message || err.toString();
  }

  return NextResponse.json({
    env: {
      hasUrl: !!url,
      hasPubKey: !!pubKey,
      hasServiceKey: !!serviceKey,
      urlPrefix: url ? url.substring(0, 15) + "..." : null,
    },
    database: {
      status: dbCheck,
      error: dbError,
      result: dbResult,
    }
  });
}
