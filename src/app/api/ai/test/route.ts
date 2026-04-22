// ============================================================
// POST /api/ai/test
// Runs a test prompt against Ollama to verify the model works.
// ============================================================

import { NextResponse } from "next/server";
import { testAIPrompt } from "@/lib/ai/client";

export async function POST() {
  try {
    const result = await testAIPrompt();

    return NextResponse.json({
      success: result.success,
      data: result.data,
      meta: result.meta,
      error: result.error,
    });
  } catch (err) {
    console.error("[api/ai/test] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Test prompt failed",
      },
      { status: 500 }
    );
  }
}