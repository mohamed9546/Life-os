import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { buildMoneyInsightSummary } from "@/lib/money/analytics";
import { createTransaction, getTransactions, updateTransaction } from "@/lib/money/storage";
import { getMerchantRules, saveMerchantRule, getMoneyReviewEntries } from "@/lib/money/reviews";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const [transactions, merchantRules, reviewEntries] = await Promise.all([
      getTransactions(user.id),
      getMerchantRules(user.id),
      getMoneyReviewEntries(user.id),
    ]);
    const summary = buildMoneyInsightSummary(transactions);

    return NextResponse.json({
      transactions,
      summary,
      merchantRules,
      latestReview: reviewEntries[0] || null,
      reviewHistory: reviewEntries.slice(1, 6),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load money data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const { date, description, amount, currency } = body as {
      date?: string;
      description?: string;
      amount?: number;
      currency?: string;
    };

    if (!date || !description || typeof amount !== "number") {
      return NextResponse.json(
        { error: "date, description, and amount are required" },
        { status: 400 }
      );
    }

    const transaction = await createTransaction(
      {
        date,
        description,
        amount,
        currency: currency || "GBP",
      },
      user.id
    );

    return NextResponse.json({ success: true, transaction });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create transaction" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const {
      transactionId,
      merchantCleaned,
      category,
      saveRule,
    } = body as {
      transactionId?: string;
      merchantCleaned?: string;
      category?: string;
      saveRule?: boolean;
    };

    if (!transactionId || !merchantCleaned || !category) {
      return NextResponse.json(
        { error: "transactionId, merchantCleaned, and category are required" },
        { status: 400 }
      );
    }

    const updated = await updateTransaction(
      transactionId,
      (current) => ({
        ...current,
        merchantCleaned,
        category,
        updatedAt: new Date().toISOString(),
      }),
      user.id
    );

    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    let rule = null;
    if (saveRule) {
      rule = await saveMerchantRule(
        {
          matchText: updated.description,
          merchantCleaned,
          category,
        },
        user.id
      );
    }

    return NextResponse.json({ success: true, transaction: updated, rule });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update transaction" },
      { status: 500 }
    );
  }
}
