import { AIResult, MoneyReview } from "@/types";
import { callAI } from "../client";
import { MoneyReviewSchema, validateAIOutput } from "../schemas";

export interface MoneyReviewInput {
  totalSpend: number;
  totalIncome: number;
  netFlow: number;
  uncategorizedCount: number;
  topCategories: Array<{ category: string; total: number }>;
  recurringMerchants: Array<{ merchant: string; count: number; total: number }>;
  unusualSpikes: Array<{ merchant: string; amount: number; average: number }>;
  lowConfidenceTransactions: Array<{ description: string; amount: number; confidence: number }>;
}

const SYSTEM_PROMPT = `You are a structured money review analyst inside a local-first personal operating system.
Be specific, practical, and honest.
Return valid JSON only.`;

function buildPrompt(input: MoneyReviewInput): string {
  return `Analyze this money state and return JSON only.

TOTALS:
- Spend: GBP ${input.totalSpend.toFixed(2)}
- Income: GBP ${input.totalIncome.toFixed(2)}
- Net flow: GBP ${input.netFlow.toFixed(2)}
- Uncategorized count: ${input.uncategorizedCount}

TOP CATEGORIES:
${input.topCategories.map((item) => `- ${item.category}: GBP ${item.total.toFixed(2)}`).join("\n") || "- None"}

RECURRING MERCHANTS:
${input.recurringMerchants.map((item) => `- ${item.merchant}: ${item.count} charges, GBP ${item.total.toFixed(2)}`).join("\n") || "- None"}

UNUSUAL SPIKES:
${input.unusualSpikes.map((item) => `- ${item.merchant}: GBP ${item.amount.toFixed(2)} vs avg GBP ${item.average.toFixed(2)}`).join("\n") || "- None"}

LOW CONFIDENCE TRANSACTIONS:
${input.lowConfidenceTransactions.map((item) => `- ${item.description}: GBP ${item.amount.toFixed(2)} (confidence ${Math.round(item.confidence * 100)}%)`).join("\n") || "- None"}

Return exactly:
{
  "narrativeSummary": "string",
  "recurringCommitments": ["string"],
  "unusualSpikes": ["string"],
  "monthlyAdjustments": ["string"],
  "stabilityWarning": "string",
  "confidence": 0.0
}`;
}

export async function summarizeMoneyState(
  input: MoneyReviewInput
): Promise<AIResult<MoneyReview> | { error: string }> {
  const result = await callAI<MoneyReview>({
    taskType: "summarize-money",
    prompt: buildPrompt(input),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: input,
    temperature: 0.2,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Money review failed" };
  }

  const validation = validateAIOutput(MoneyReviewSchema, result.data);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: validation.data.confidence },
    rawInput: input,
    rawOutput: result.rawOutput,
  };
}
