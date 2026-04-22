// ============================================================
// POST /api/ai/parse-job
// Accepts raw job text, returns structured parsed job data.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { parseJobPosting } from "@/lib/ai/tasks/parse-job";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawText, metadata } = body as {
      rawText?: string;
      metadata?: Record<string, string>;
    };

    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 20) {
      return NextResponse.json(
        { error: "rawText is required and must be at least 20 characters" },
        { status: 400 }
      );
    }

    const result = await parseJobPosting(rawText, metadata);

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
    console.error("[api/ai/parse-job] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Parse failed",
      },
      { status: 500 }
    );
  }
}