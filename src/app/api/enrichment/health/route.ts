import { NextResponse } from "next/server";
import { checkApolloHealth } from "@/lib/enrichment";

export async function GET() {
  try {
    const apollo = await checkApolloHealth();

    return NextResponse.json({
      apollo,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Health check failed" },
      { status: 500 }
    );
  }
}