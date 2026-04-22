import { NextRequest, NextResponse } from "next/server";
import { findEmail } from "@/lib/enrichment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, companyDomain } = body as {
      firstName?: string;
      lastName?: string;
      companyDomain?: string;
    };

    if (!firstName || !lastName || !companyDomain) {
      return NextResponse.json(
        { error: "firstName, lastName, and companyDomain are required" },
        { status: 400 }
      );
    }

    const result = await findEmail(firstName, lastName, companyDomain);

    return NextResponse.json({
      success: Boolean(result.email),
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Email lookup failed" },
      { status: 500 }
    );
  }
}
