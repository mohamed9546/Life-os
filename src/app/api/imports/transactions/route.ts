import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { categorizeTransaction } from "@/lib/ai/tasks/categorize-transaction";
import { saveImportRecord } from "@/lib/imports/storage";
import {
  buildTransactionEntities,
  coerceTransactionImports,
  parseJsonArrayPayload,
  parseTransactionsCsv,
} from "@/lib/imports/parsers";
import { findMerchantRule } from "@/lib/money/reviews";
import { saveTransactions } from "@/lib/money/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireAppUser();
  let operationType: "transactions-csv" | "transactions-json" = "transactions-csv";

  try {
    const body = await request.json();
    const { format, input, runAI } = body as {
      format?: "csv" | "json";
      input?: string;
      runAI?: boolean;
    };

    if (!format || !input?.trim()) {
      return NextResponse.json(
        { error: "format and input are required" },
        { status: 400 }
      );
    }

    operationType = format === "csv" ? "transactions-csv" : "transactions-json";

    const rows =
      format === "csv"
        ? parseTransactionsCsv(input)
        : coerceTransactionImports(parseJsonArrayPayload(input));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No usable transactions were found in the import payload" },
        { status: 400 }
      );
    }

    const transactions = buildTransactionEntities(rows);
    let enriched = 0;

    if (runAI !== false) {
      for (const transaction of transactions.slice(0, 20)) {
        const matchingRule = await findMerchantRule(transaction.description, user.id);
        if (matchingRule) {
          transaction.category = matchingRule.category;
          transaction.merchantCleaned = matchingRule.merchantCleaned;
          enriched += 1;
          continue;
        }

        const result = await categorizeTransaction(transaction.description, transaction.amount);
        if (!("error" in result)) {
          transaction.aiCategorization = result;
          transaction.category = result.data.category;
          transaction.merchantCleaned = result.data.merchantCleaned;
          enriched += 1;
        }
      }
    }

    await saveTransactions(transactions, user.id);

    const record = await saveImportRecord(
      {
        type: format === "csv" ? "transactions-csv" : "transactions-json",
        label: format === "csv" ? "CSV transaction import" : "JSON transaction import",
        status: "success",
        counts: {
          received: rows.length,
          imported: transactions.length,
          failed: 0,
        },
        summary:
          enriched > 0
            ? `Imported ${transactions.length} transactions and AI-categorized ${enriched}.`
            : `Imported ${transactions.length} transactions.`,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      record,
      imported: transactions.length,
      enriched,
    });
  } catch (err) {
    await saveImportRecord(
      {
        type: operationType,
        label: "Transaction import failed",
        status: "failed",
        counts: {
          received: 0,
          imported: 0,
          failed: 1,
        },
        summary: err instanceof Error ? err.message : "Transaction import failed",
      },
      user.id
    );

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import transactions" },
      { status: 500 }
    );
  }
}
