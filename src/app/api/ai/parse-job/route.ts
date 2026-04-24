// ============================================================
// POST /api/ai/parse-job
// Accepts raw job text, returns structured parsed job data.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { parseJobPosting } from "@/lib/ai/tasks/parse-job";
import { callPythonAI, isPythonAIEnabled } from "@/lib/ai/python-sidecar";
import type { AIMetadata, ParsedJobPosting } from "@/types";

interface SidecarResponse {
  success: boolean;
  data?: ParsedJobPosting;
  meta?: AIMetadata;
  error?: string;
}

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

    // Proxy to Python sidecar when the feature flag is on.
    // On any sidecar failure we fall through to the TS implementation so
    // a broken sidecar never blocks the main app.
    if (isPythonAIEnabled()) {
      try {
        const result = await callPythonAI<
          { rawText: string; metadata?: Record<string, string> },
          SidecarResponse
        >("/parse-job", { rawText, metadata }, 300_000);

        if (result.success && result.data) {
          return NextResponse.json({
            success: true,
            data: result.data,
            meta: result.meta,
          });
        }

        console.warn(
          "[api/ai/parse-job] Python sidecar returned failure, falling back to TS:",
          result.error
        );
      } catch (err) {
        console.warn(
          "[api/ai/parse-job] Python sidecar call failed, falling back to TS:",
          err instanceof Error ? err.message : err
        );
      }
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
