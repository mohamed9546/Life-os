// ============================================================
// AI Task: Categorize a financial transaction.
// ============================================================

import { TransactionCategorization, AIResult } from "@/types";
import { callAI } from "../client";
import {
  TransactionCategorizationSchema,
  validateAIOutput,
} from "../schemas";

const SYSTEM_PROMPT = `You are a personal finance categorization assistant.
Categorize transactions into clear, consistent categories.
Clean up merchant names to be human-readable.
Always respond with valid JSON only.`;

const CATEGORIES = [
  "Housing",
  "Utilities",
  "Groceries",
  "Dining",
  "Transport",
  "Health",
  "Insurance",
  "Subscriptions",
  "Entertainment",
  "Shopping",
  "Personal Care",
  "Education",
  "Income",
  "Transfer",
  "Savings",
  "Investment",
  "Charity",
  "Fees",
  "Other",
];

function buildPrompt(description: string, amount: number): string {
  return `Categorize this transaction and return JSON:

Transaction: "${description}"
Amount: ${amount}

Available categories: ${CATEGORIES.join(", ")}

Return exactly:
{
  "category": "one of the categories above",
  "merchantCleaned": "human-readable merchant name",
  "confidence": 0.0 to 1.0,
  "notes": "brief note if anything notable about this transaction"
}

Respond with ONLY the JSON object.`;
}

export async function categorizeTransaction(
  description: string,
  amount: number
): Promise<AIResult<TransactionCategorization> | { error: string }> {
  const result = await callAI<TransactionCategorization>({
    taskType: "categorize-transaction",
    prompt: buildPrompt(description, amount),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: { description, amount },
    temperature: 0.05,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Categorization failed" };
  }

  const validation = validateAIOutput(
    TransactionCategorizationSchema,
    result.data
  );
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: validation.data.confidence },
    rawInput: { description, amount },
    rawOutput: result.rawOutput,
  };
}
