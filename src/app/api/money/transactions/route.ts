import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { createTransaction, getTransactions } from "@/lib/money/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const transactions = await getTransactions(user.id);
    return NextResponse.json({ transactions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json() as {
      date?: string;
      description?: string;
      amount?: number;
      currency?: string;
      category?: string;
    };

    const { date, description, amount, currency, category } = body;

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
        ...(category ? { category } : {}),
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
