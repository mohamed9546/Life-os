// ============================================================
// POST /api/ai/summarize-decision
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { summarizeDecision } from "@/lib/ai/tasks/summarize-decision";
import { Decision } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { decision } = body as { decision?: Decision };

    if (!decision || !decision.title || !decision.context) {
      return NextResponse.json(
        { error: "decision with title and context is required" },
        { status: 400 }
      );
    }

    const result = await summarizeDecision(decision);

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (err) {
    console.error("[api/ai/summarize-decision] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Summary failed",
      },
      { status: 500 }
    );
  }
}