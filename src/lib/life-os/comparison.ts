import { WeeklyReviewComparison } from "@/types";
import { StoredWeeklyReviewEntry } from "./storage";

export function buildWeeklyReviewComparison(
  current: StoredWeeklyReviewEntry | null,
  previous: StoredWeeklyReviewEntry | null
): WeeklyReviewComparison | null {
  if (!current) {
    return null;
  }

  const currentRisks = current.review.data.risks || [];
  const previousRisks = previous?.review.data.risks || [];
  const currentFocus = current.review.data.nextWeekOperatingFocus || [];
  const previousFocus = previous?.review.data.nextWeekOperatingFocus || [];

  return {
    currentId: current.id,
    previousId: previous?.id || null,
    repeatedRisks: intersect(currentRisks, previousRisks),
    repeatedFocusThemes: intersect(currentFocus, previousFocus),
    risingSignals: currentRisks.filter((risk) => !previousRisks.includes(risk)).slice(0, 4),
    changedSignals: currentFocus.filter((focus) => !previousFocus.includes(focus)).slice(0, 4),
  };
}

function intersect(left: string[], right: string[]): string[] {
  const set = new Set(right);
  return left.filter((item) => set.has(item));
}
