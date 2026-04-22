import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { generateWeeklyReview } from "@/lib/life-os/weekly-review";
import { getWeeklyReviewEntries } from "@/lib/life-os/storage";
import { buildWeeklyReviewComparison } from "@/lib/life-os/comparison";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const entries = await getWeeklyReviewEntries(user.id);
    return NextResponse.json({
      entries,
      comparison: buildWeeklyReviewComparison(entries[0] || null, entries[1] || null),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load weekly reviews" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await requireAppUser();
    const result = await generateWeeklyReview(user.id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      entry: result.saved,
      input: result.input,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate weekly review" },
      { status: 500 }
    );
  }
}
