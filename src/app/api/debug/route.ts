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
  let writeCheck = "not attempted";
  let writeError = null;

  try {
    const supabase = createServiceClient();
    if (supabase) {
      dbCheck = "attempting connection...";
      // Test read
      const { data, error } = await supabase.from("storage_kv").select("key").limit(1);
      if (error) {
        dbCheck = "read failed";
        dbError = error;
      } else {
        dbCheck = "read success";
        dbResult = data;
        
        // Test write
        writeCheck = "attempting to delete app-config from DB...";
        const { error: wError } = await supabase.from("storage_kv").delete().eq("key", "app-config");
        
        if (wError) {
          writeCheck = "delete failed";
          writeError = wError;
        } else {
          writeCheck = "delete success! Now app will use hardcoded defaults.";
        }
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
      writeStatus: writeCheck,
      writeError: writeError,
    }
  });
}
