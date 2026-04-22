import { summarizeWeek } from "@/lib/ai";
import { getRankedJobs, getEnrichedJobs } from "@/lib/jobs/storage";
import { getTransactions } from "@/lib/money/storage";
import { buildMoneyInsightSummary } from "@/lib/money/analytics";
import { getDecisions } from "@/lib/decisions/storage";
import { saveWeeklyReviewEntry } from "@/lib/life-os/storage";
import { getRoutineCheckIns, getRoutines } from "@/lib/routines/storage";
import { buildRoutineAnalytics } from "@/lib/routines/analytics";

export async function generateWeeklyReview(userId: string) {
  const [rankedJobs, trackedJobs, transactions, decisions, routines, routineCheckIns] =
    await Promise.all([
      getRankedJobs(userId),
      getEnrichedJobs(userId),
      getTransactions(userId),
      getDecisions(userId),
      getRoutines(userId),
      getRoutineCheckIns(userId),
    ]);

  const money = buildMoneyInsightSummary(transactions);
  const routineAnalytics = buildRoutineAnalytics(routines, routineCheckIns);
  const input = {
    jobsReviewed: rankedJobs.length,
    jobsTracked: trackedJobs.filter((job) => job.status === "tracked").length,
    jobsApplied: trackedJobs.filter((job) => job.status === "applied").length,
    topJobs: rankedJobs.slice(0, 5).map((job) => ({
      title: job.parsed?.data.title || job.raw.title,
      company: job.parsed?.data.company || job.raw.company,
      fitScore: job.fit?.data.fitScore || 0,
    })),
    transactionCount: transactions.length,
    totalSpend: money.totalSpend,
    topCategories: money.topCategories,
    openDecisions: decisions.filter((decision) => decision.status === "open").length,
    completedDecisions: decisions.filter((decision) => decision.status !== "open").length,
    routinesEnabled: routines.filter((routine) => routine.enabled).length,
    routineCheckInsLast7Days: routineAnalytics.completedLast7Days + routineAnalytics.skippedLast7Days,
    consistencyScore: routineAnalytics.consistencyScore,
    skippedLoopWarnings: routineAnalytics.skippedLoopWarnings,
  };

  const result = await summarizeWeek(input);
  if ("error" in result) {
    return result;
  }

  const saved = await saveWeeklyReviewEntry({ review: result, input }, userId);
  return {
    result,
    saved,
    input,
  };
}
