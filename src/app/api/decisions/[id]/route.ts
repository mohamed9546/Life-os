import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { updateDecision, getDecisions } from "@/lib/decisions/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAppUser();
    const decisions = await getDecisions(user.id);
    const decision = decisions.find((d) => d.id === params.id);
    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }
    return NextResponse.json({ decision });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load decision" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAppUser();
    const body = await request.json() as Record<string, unknown>;

    const updated = await updateDecision(
      params.id,
      (current) => ({
        ...current,
        ...body,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      }),
      user.id
    );

    if (!updated) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, decision: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update decision" },
      { status: 500 }
    );
  }
}
