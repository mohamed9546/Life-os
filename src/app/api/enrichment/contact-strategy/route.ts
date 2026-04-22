import { NextRequest, NextResponse } from "next/server";
import { buildContactStrategy } from "@/lib/enrichment";
import { ParsedJobPosting, JobFitEvaluation, RawJobItem } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raw, parsed, fit } = body as {
      raw?: RawJobItem;
      parsed?: ParsedJobPosting;
      fit?: JobFitEvaluation;
    };

    if (!raw || !parsed || !fit) {
      return NextResponse.json(
        { error: "raw, parsed, and fit are required" },
        { status: 400 }
      );
    }

    const result = await buildContactStrategy(raw, parsed, fit);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Contact strategy failed" },
      { status: 500 }
    );
  }
}
