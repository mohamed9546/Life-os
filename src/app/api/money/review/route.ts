import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { generateMoneyReview } from "@/lib/money/review";
import { getMoneyReviewEntries } from "@/lib/money/reviews";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const entries = await getMoneyReviewEntries(user.id);
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load money reviews" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await requireAppUser();
    const result = await generateMoneyReview(user.id);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      entry: result.saved,
      input: result.input,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate money review" },
      { status: 500 }
    );
  }
}
