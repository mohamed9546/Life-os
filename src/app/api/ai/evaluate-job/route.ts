// ============================================================
// POST /api/ai/evaluate-job
// Accepts a parsed job posting, returns fit evaluation.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { evaluateJobFit } from "@/lib/ai/tasks/evaluate-job";
import { loadAIConfig } from "@/lib/ai/config";
import { ParsedJobPostingSchema } from "@/lib/ai/schemas";
import { callPythonAI, isPythonAIEnabled } from "@/lib/ai/python-sidecar";
import type { AIMetadata, JobFitEvaluation, ParsedJobPosting } from "@/types";

interface SidecarResponse {
  success: boolean;
  data?: JobFitEvaluation;
  meta?: AIMetadata;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job } = body as { job?: unknown };

    if (!job) {
      return NextResponse.json(
        { error: "job object is required" },
        { status: 400 }
      );
    }

    const validation = ParsedJobPostingSchema.safeParse(job);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid job data",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    // Proxy to Python sidecar when the feature flag is on; fall back to
    // the TS implementation if the sidecar is unreachable or returns an
    // error so a broken sidecar never blocks the main app.
    const aiConfig = await loadAIConfig();
    const shouldUsePythonSidecar = isPythonAIEnabled() && aiConfig.provider === "ollama";

    if (shouldUsePythonSidecar) {
      try {
        const result = await callPythonAI<
          { job: ParsedJobPosting },
          SidecarResponse
        >("/evaluate-job", { job: validation.data }, 360_000);

        if (result.success && result.data) {
          return NextResponse.json({
            success: true,
            data: result.data,
            meta: result.meta,
          });
        }

        console.warn(
          "[api/ai/evaluate-job] Python sidecar returned failure, falling back to TS:",
          result.error
        );
      } catch (err) {
        console.warn(
          "[api/ai/evaluate-job] Python sidecar call failed, falling back to TS:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const result = await evaluateJobFit(validation.data);

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
    console.error("[api/ai/evaluate-job] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Evaluation failed",
      },
      { status: 500 }
    );
  }
}
