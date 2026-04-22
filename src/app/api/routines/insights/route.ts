import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getRoutineCheckIns, getRoutines } from "@/lib/routines/storage";
import { buildRoutineAnalytics } from "@/lib/routines/analytics";
import { suggestRoutineFocus } from "@/lib/ai";
import { getRoutineInsights, saveRoutineInsight } from "@/lib/routines/insights";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const [entries, routines, checkIns] = await Promise.all([
      getRoutineInsights(user.id),
      getRoutines(user.id),
      getRoutineCheckIns(user.id),
    ]);
    const analytics = buildRoutineAnalytics(routines, checkIns);

    return NextResponse.json({
      analytics,
      latestInsight: entries[0] || null,
      history: entries.slice(1, 6),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load routine insights" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await requireAppUser();
    const [routines, checkIns] = await Promise.all([
      getRoutines(user.id),
      getRoutineCheckIns(user.id),
    ]);
    const analytics = buildRoutineAnalytics(routines, checkIns);
    const result = await suggestRoutineFocus(analytics);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const saved = await saveRoutineInsight({ insight: result, input: analytics }, user.id);
    return NextResponse.json({ success: true, entry: saved, analytics });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate routine insight" },
      { status: 500 }
    );
  }
}
