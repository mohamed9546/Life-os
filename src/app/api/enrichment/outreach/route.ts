import { NextRequest, NextResponse } from "next/server";
import { generateOutreachStrategy } from "@/lib/enrichment";
import { ParsedJobPosting, CompanyIntel, DecisionMaker } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job, companyIntel, decisionMakers } = body as {
      job: ParsedJobPosting;
      companyIntel?: CompanyIntel | null;
      decisionMakers?: DecisionMaker[];
    };

    if (!job || !job.title) {
      return NextResponse.json(
        { error: "job data is required" },
        { status: 400 }
      );
    }

    const strategy = await generateOutreachStrategy(
      job,
      companyIntel || null,
      decisionMakers || []
    );

    return NextResponse.json({
      success: !!strategy,
      data: strategy,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Outreach generation failed" },
      { status: 500 }
    );
  }
}