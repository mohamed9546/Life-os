import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { categorizeTransaction } from "@/lib/ai";
import { getTransactions, updateTransaction } from "@/lib/money/storage";
import { findMerchantRule } from "@/lib/money/reviews";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => ({}));
    const { transactionId } = body as { transactionId?: string };

    const transactions = await getTransactions(user.id);
    const targets = transactionId
      ? transactions.filter((transaction) => transaction.id === transactionId)
      : transactions.filter(
          (transaction) => !transaction.category && !transaction.aiCategorization
        );

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        categorized: 0,
        failed: 0,
      });
    }

    let categorized = 0;
    let failed = 0;

    for (const transaction of targets.slice(0, 25)) {
      const matchingRule = await findMerchantRule(transaction.description, user.id);
      if (matchingRule) {
        await updateTransaction(
          transaction.id,
          (current) => ({
            ...current,
            category: matchingRule.category,
            merchantCleaned: matchingRule.merchantCleaned,
            updatedAt: new Date().toISOString(),
          }),
          user.id
        );
        categorized += 1;
        continue;
      }

      const result = await categorizeTransaction(
        transaction.description,
        transaction.amount
      );

      if ("error" in result) {
        failed += 1;
        continue;
      }

      await updateTransaction(
        transaction.id,
        (current) => ({
          ...current,
          category: result.data.category,
          merchantCleaned: result.data.merchantCleaned,
          aiCategorization: result,
          updatedAt: new Date().toISOString(),
        }),
        user.id
      );
      categorized += 1;
    }

    return NextResponse.json({
      success: true,
      categorized,
      failed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to categorize transactions" },
      { status: 500 }
    );
  }
}
