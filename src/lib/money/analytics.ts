import { Transaction } from "@/types";

export interface MoneyInsightSummary {
  totalSpend: number;
  totalIncome: number;
  netFlow: number;
  uncategorizedCount: number;
  topCategories: Array<{ category: string; total: number }>;
  recurringMerchants: Array<{ merchant: string; count: number; total: number }>;
  unusualSpikes: Array<{ merchant: string; amount: number; average: number }>;
  lowConfidenceTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    confidence: number;
  }>;
  stabilityWarning: string | null;
  recommendedAdjustments: string[];
}

export function buildMoneyInsightSummary(
  transactions: Transaction[]
): MoneyInsightSummary {
  const expenses = transactions.filter((transaction) => transaction.amount < 0);
  const income = transactions.filter((transaction) => transaction.amount > 0);
  const uncategorizedCount = transactions.filter(
    (transaction) => !transaction.category && !transaction.aiCategorization?.data.category
  ).length;

  const categoryTotals = new Map<string, number>();
  const merchantStats = new Map<string, { count: number; total: number; amounts: number[] }>();

  for (const transaction of expenses) {
    const category =
      transaction.category ||
      transaction.aiCategorization?.data.category ||
      "Uncategorized";
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + Math.abs(transaction.amount));

    const merchant =
      transaction.merchantCleaned ||
      transaction.aiCategorization?.data.merchantCleaned ||
      normalizeMerchant(transaction.description);
    const existing = merchantStats.get(merchant) || {
      count: 0,
      total: 0,
      amounts: [],
    };
    existing.count += 1;
    existing.total += Math.abs(transaction.amount);
    existing.amounts.push(Math.abs(transaction.amount));
    merchantStats.set(merchant, existing);
  }

  const recurringMerchants = Array.from(merchantStats.entries())
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total)
    .slice(0, 5)
    .map(([merchant, stats]) => ({
      merchant,
      count: stats.count,
      total: roundCurrency(stats.total),
    }));

  const unusualSpikes = Array.from(merchantStats.entries())
    .flatMap(([merchant, stats]) => {
      if (stats.amounts.length < 2) {
        return [];
      }

      const average =
        stats.amounts.reduce((sum, amount) => sum + amount, 0) / stats.amounts.length;
      const highest = Math.max(...stats.amounts);
      if (highest >= average * 1.6 && highest - average >= 20) {
        return [
          {
            merchant,
            amount: roundCurrency(highest),
            average: roundCurrency(average),
          },
        ];
      }

      return [];
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const totalSpend = roundCurrency(
    expenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
  );
  const totalIncome = roundCurrency(
    income.reduce((sum, transaction) => sum + transaction.amount, 0)
  );
  const netFlow = roundCurrency(totalIncome - totalSpend);
  const topCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, total]) => ({ category, total: roundCurrency(total) }));

  const stabilityWarning =
    netFlow < 0
      ? "You spent more than came in over the current dataset. Watch cash burn before adding more optional spend."
      : totalSpend > 0 && totalIncome > 0 && totalSpend / totalIncome > 0.8
        ? "Spending is close to income. Keep discretionary categories tight until the gap is wider."
        : unusualSpikes.length > 0
          ? "A few merchants show larger-than-usual charges. Double-check whether those were planned or one-offs."
          : null;

  const recommendedAdjustments = [
    uncategorizedCount > 0 ? `Categorize the remaining ${uncategorizedCount} uncategorized transactions so the trends stay trustworthy.` : null,
    topCategories[0] ? `Review ${topCategories[0].category} first. It is currently your largest spending category.` : null,
    recurringMerchants[0] ? `Audit recurring spend from ${recurringMerchants[0].merchant} and confirm it still earns its place.` : null,
    netFlow < 0 ? "Pause non-essential purchases until income and spending are back in balance." : null,
  ].filter((item): item is string => Boolean(item));

  const lowConfidenceTransactions = transactions
    .filter((transaction) => {
      const confidence = transaction.aiCategorization?.data.confidence ?? 0;
      return !transaction.category || !transaction.merchantCleaned || confidence < 0.7;
    })
    .slice(0, 8)
    .map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      confidence: transaction.aiCategorization?.data.confidence ?? 0,
    }));

  return {
    totalSpend,
    totalIncome,
    netFlow,
    uncategorizedCount,
    topCategories,
    recurringMerchants,
    unusualSpikes,
    lowConfidenceTransactions,
    stabilityWarning,
    recommendedAdjustments,
  };
}

function normalizeMerchant(description: string): string {
  return description
    .replace(/\d+/g, " ")
    .replace(/[*#/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32) || "Unknown";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
