// ============================================================
// POST /api/ai/evaluate-job
// Accepts a parsed job posting, returns fit evaluation.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { evaluateJobFit } from "@/lib/ai/tasks/evaluate-job";
import { ParsedJobPostingSchema } from "@/lib/ai/schemas";

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