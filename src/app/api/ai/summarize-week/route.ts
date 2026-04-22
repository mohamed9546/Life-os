// ============================================================
// POST /api/ai/summarize-week
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { summarizeWeek, WeeklyReviewInput } from "@/lib/ai/tasks/summarize-week";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = body as WeeklyReviewInput;

    if (typeof input.jobsReviewed !== "number") {
      return NextResponse.json(
        { error: "WeeklyReviewInput object is required" },
        { status: 400 }
      );
    }

    const result = await summarizeWeek(input);

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
    console.error("[api/ai/summarize-week] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Weekly review failed",
      },
      { status: 500 }
    );
  }
}