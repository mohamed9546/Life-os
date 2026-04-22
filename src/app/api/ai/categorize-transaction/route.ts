// ============================================================
// POST /api/ai/categorize-transaction
// Categorize a single transaction.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { categorizeTransaction } from "@/lib/ai/tasks/categorize-transaction";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, amount } = body as {
      description?: string;
      amount?: number;
    };

    if (!description || typeof amount !== "number") {
      return NextResponse.json(
        { error: "description (string) and amount (number) are required" },
        { status: 400 }
      );
    }

    const result = await categorizeTransaction(description, amount);

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (err) {
    console.error("[api/ai/categorize-transaction] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Categorization failed",
      },
      { status: 500 }
    );
  }
}