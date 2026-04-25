import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { syncAllJobsToNotion } from "@/lib/integrations/notion-jobs";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireAppUser();
    const result = await syncAllJobsToNotion(user.id);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Notion sync failed" },
      { status: 500 }
    );
  }
}
