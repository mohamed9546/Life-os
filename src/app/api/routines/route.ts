import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  createRoutine,
  getRoutineCheckIns,
  getRoutines,
} from "@/lib/routines/storage";
import { buildRoutineAnalytics } from "@/lib/routines/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const [routines, checkIns] = await Promise.all([
      getRoutines(user.id),
      getRoutineCheckIns(user.id),
    ]);

    const today = new Date().getDay();
    const completedTodayIds = new Set(
      checkIns
        .filter((entry) => new Date(entry.completedAt).toDateString() === new Date().toDateString())
        .map((entry) => entry.routineId)
    );

    const summary = {
      total: routines.length,
      enabled: routines.filter((routine) => routine.enabled).length,
      dueToday: routines.filter((routine) => isRoutineDueToday(routine, today)).length,
      completedToday: completedTodayIds.size,
    };

    return NextResponse.json({
      routines,
      checkIns: checkIns.slice(0, 40),
      summary,
      analytics: buildRoutineAnalytics(routines, checkIns),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load routines" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const {
      title,
      description,
      area,
      cadence,
      targetDays,
      enabled,
      aiPrompt,
    } = body as {
      title?: string;
      description?: string;
      area?: "career" | "money" | "life" | "health" | "admin";
      cadence?: "daily" | "weekly" | "custom";
      targetDays?: number[];
      enabled?: boolean;
      aiPrompt?: string;
    };

    if (!title || !area || !cadence) {
      return NextResponse.json(
        { error: "title, area, and cadence are required" },
        { status: 400 }
      );
    }

    const routine = await createRoutine(
      {
        title,
        description: description || undefined,
        area,
        cadence,
        targetDays: cadence === "custom" ? targetDays || [] : undefined,
        enabled: enabled ?? true,
        aiPrompt: aiPrompt || undefined,
      },
      user.id
    );

    return NextResponse.json({ success: true, routine });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create routine" },
      { status: 500 }
    );
  }
}

function isRoutineDueToday(
  routine: { enabled: boolean; cadence: string; targetDays?: number[] },
  today: number
) {
  if (!routine.enabled) {
    return false;
  }

  if (routine.cadence === "daily") {
    return true;
  }

  if (routine.cadence === "weekly") {
    return today === 1;
  }

  return (routine.targetDays || []).includes(today);
}
