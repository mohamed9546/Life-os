import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { recordShutdownEntry } from "@/lib/opencode/shutdown";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as {
      wins?: string[];
      blockers?: string[];
      top3?: string[];
      energy?: number;
      notes?: string;
    };

    const entry = await recordShutdownEntry({
      wins: body.wins || [],
      blockers: body.blockers || [],
      top3: body.top3 || [],
      energy: body.energy || 3,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save shutdown entry" },
      { status: 500 }
    );
  }
}
