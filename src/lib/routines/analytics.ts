import { Routine, RoutineAnalytics, RoutineCheckIn } from "@/types";

export function buildRoutineAnalytics(
  routines: Routine[],
  checkIns: RoutineCheckIn[]
): RoutineAnalytics {
  const last7Days = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = checkIns.filter(
    (entry) => new Date(entry.completedAt).getTime() >= last7Days
  );
  const completedLast7Days = recent.filter((entry) => entry.status === "completed").length;
  const skippedLast7Days = recent.filter((entry) => entry.status === "skipped").length;
  const enabledRoutines = routines.filter((routine) => routine.enabled);
  const today = new Date().getDay();
  const dueToday = enabledRoutines.filter((routine) => isRoutineDueToday(routine, today)).length;

  const areaBalance = (["career", "money", "life", "health", "admin"] as const).map(
    (area) => ({
      area,
      enabled: enabledRoutines.filter((routine) => routine.area === area).length,
      completedLast7Days: recent.filter(
        (entry) =>
          entry.status === "completed" &&
          enabledRoutines.find((routine) => routine.id === entry.routineId)?.area === area
      ).length,
    })
  );

  const consistencyScore = enabledRoutines.length
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round((completedLast7Days / Math.max(enabledRoutines.length, 1)) * 35) +
            Math.round((completedLast7Days / Math.max(completedLast7Days + skippedLast7Days, 1)) * 65)
        )
      )
    : 0;

  const skippedLoopWarnings = enabledRoutines
    .filter((routine) => {
      const recentEntries = recent.filter((entry) => entry.routineId === routine.id);
      return recentEntries.length >= 2 && recentEntries.every((entry) => entry.status === "skipped");
    })
    .map((routine) => `${routine.title} has been skipped repeatedly over the last week.`);

  const nextBestAction =
    skippedLoopWarnings[0] ||
    (dueToday > 0
      ? `Complete ${dueToday} due routine${dueToday === 1 ? "" : "s"} today to keep the system current.`
      : "Keep the strongest current routine streak alive with one meaningful completion today.");

  return {
    consistencyScore,
    completedLast7Days,
    skippedLast7Days,
    dueToday,
    areaBalance,
    skippedLoopWarnings,
    nextBestAction,
  };
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
