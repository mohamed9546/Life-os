import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { buildOpenCodeMonthReview } from "@/lib/opencode/month-review";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const month = request.nextUrl.searchParams.get("month") || undefined;
    const review = await buildOpenCodeMonthReview(user.id, month);
    return NextResponse.json(review);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build month review" },
      { status: 500 }
    );
  }
}
