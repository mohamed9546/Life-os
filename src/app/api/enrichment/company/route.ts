import { NextRequest, NextResponse } from "next/server";
import { enrichCompanyByName, enrichCompanyByDomain } from "@/lib/enrichment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, domain, location } = body as {
      company?: string;
      domain?: string;
      location?: string;
    };

    if (!company && !domain) {
      return NextResponse.json(
        { error: "company name or domain is required" },
        { status: 400 }
      );
    }

    let intel;
    if (domain) {
      intel = await enrichCompanyByDomain(domain);
    } else {
      intel = await enrichCompanyByName(company!, location);
    }

    return NextResponse.json({
      success: !!intel,
      data: intel,
      error: intel ? undefined : "Company not found in Apollo",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}