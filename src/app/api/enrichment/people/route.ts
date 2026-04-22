import { NextRequest, NextResponse } from "next/server";
import { findDecisionMakers } from "@/lib/enrichment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, domain, department, roleFamily } = body as {
      company?: string;
      domain?: string;
      department?: string;
      roleFamily?: string;
    };

    if (!company) {
      return NextResponse.json(
        { error: "company name is required" },
        { status: 400 }
      );
    }

    const people = await findDecisionMakers(company, domain, {
      department,
      roleFamily,
    });

    return NextResponse.json({
      success: true,
      data: people,
      count: people.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "People search failed" },
      { status: 500 }
    );
  }
}