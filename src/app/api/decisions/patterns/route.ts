import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getDecisionPatternReviews } from "@/lib/decisions/pattern-storage";
import { generateDecisionPatternReview } from "@/lib/decisions/pattern-review";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const entries = await getDecisionPatternReviews(user.id);
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load decision pattern reviews" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await requireAppUser();
    const result = await generateDecisionPatternReview(user.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      entry: result.saved,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate decision pattern review" },
      { status: 500 }
    );
  }
}
