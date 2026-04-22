import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getDecisions, updateDecision } from "@/lib/decisions/storage";
import { summarizeDecision } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const { decisionId } = body as { decisionId?: string };

    if (!decisionId) {
      return NextResponse.json(
        { error: "decisionId is required" },
        { status: 400 }
      );
    }

    const decisions = await getDecisions(user.id);
    const decision = decisions.find((item) => item.id === decisionId);
    if (!decision) {
      return NextResponse.json(
        { error: "Decision not found" },
        { status: 404 }
      );
    }

    const result = await summarizeDecision(decision);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      );
    }

    const updated = await updateDecision(
      decisionId,
      (current) => ({
        ...current,
        aiSummary: result,
        updatedAt: new Date().toISOString(),
      }),
      user.id
    );

    return NextResponse.json({
      success: true,
      decision: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze decision" },
      { status: 500 }
    );
  }
}
