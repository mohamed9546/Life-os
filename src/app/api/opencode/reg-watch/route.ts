import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { buildRegWatchDigest } from "@/lib/opencode/reg-watch";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAppUser();
    const digest = await buildRegWatchDigest();
    return NextResponse.json({ success: true, ...digest });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regulatory watch failed" },
      { status: 500 }
    );
  }
}
