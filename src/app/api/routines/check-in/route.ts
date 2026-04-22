import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  getRoutineCheckIns,
  saveRoutineCheckIn,
  updateRoutine,
} from "@/lib/routines/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const { routineId, status, note } = body as {
      routineId?: string;
      status?: "completed" | "skipped";
      note?: string;
    };

    if (!routineId || !status) {
      return NextResponse.json(
        { error: "routineId and status are required" },
        { status: 400 }
      );
    }

    const completedAt = new Date().toISOString();
    const checkIn = await saveRoutineCheckIn(
      {
        routineId,
        status,
        note: note || undefined,
        completedAt,
      },
      user.id
    );

    const allCheckIns = await getRoutineCheckIns(user.id);
    const routineCheckIns = [checkIn, ...allCheckIns].filter((item) => item.routineId === routineId);
    const streak = calculateStreak(routineCheckIns);

    const routine = await updateRoutine(
      routineId,
      (current) => ({
        ...current,
        streak,
        lastCompletedAt: status === "completed" ? completedAt : current.lastCompletedAt,
        updatedAt: completedAt,
      }),
      user.id
    );

    return NextResponse.json({ success: true, checkIn, routine });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check in routine" },
      { status: 500 }
    );
  }
}

function calculateStreak(
  checkIns: Array<{ status: "completed" | "skipped"; completedAt: string }>
) {
  const completedDays = Array.from(
    new Set(
      checkIns
        .filter((entry) => entry.status === "completed")
        .map((entry) => new Date(entry.completedAt).toDateString())
    )
  );

  let streak = 0;
  const cursor = new Date();

  while (completedDays.includes(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
