import { summarizeMoneyState } from "@/lib/ai";
import { buildMoneyInsightSummary } from "@/lib/money/analytics";
import { getTransactions } from "@/lib/money/storage";
import { saveMoneyReviewEntry } from "@/lib/money/reviews";

export async function generateMoneyReview(userId: string) {
  const transactions = await getTransactions(userId);
  const summary = buildMoneyInsightSummary(transactions);

  const input = {
    totalSpend: summary.totalSpend,
    totalIncome: summary.totalIncome,
    netFlow: summary.netFlow,
    uncategorizedCount: summary.uncategorizedCount,
    topCategories: summary.topCategories,
    recurringMerchants: summary.recurringMerchants,
    unusualSpikes: summary.unusualSpikes,
    lowConfidenceTransactions: summary.lowConfidenceTransactions.map((item) => ({
      description: item.description,
      amount: item.amount,
      confidence: item.confidence,
    })),
  };

  const result = await summarizeMoneyState(input);
  if ("error" in result) {
    return result;
  }

  const saved = await saveMoneyReviewEntry({ review: result, input }, userId);
  return { result, saved, input };
}
