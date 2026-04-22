// ============================================================
// AI Task: Summarize a decision and extract hidden assumptions/risks.
// ============================================================

import { Decision, DecisionSummary, AIResult } from "@/types";
import { callAI } from "../client";
import { DecisionSummarySchema, validateAIOutput } from "../schemas";

const SYSTEM_PROMPT = `You are a strategic thinking assistant.
Analyze decisions to surface hidden assumptions, risks, and useful review questions.
Be direct and practical. Avoid generic platitudes.
Always respond with valid JSON only.`;

function buildPrompt(decision: Decision): string {
  return `Analyze this decision and return structured JSON:

DECISION: ${decision.title}
CONTEXT: ${decision.context}
OPTIONS CONSIDERED: ${decision.options.join(", ")}
${decision.chosenOption ? `CHOSEN: ${decision.chosenOption}` : "NOT YET DECIDED"}
${decision.outcome ? `OUTCOME: ${decision.outcome}` : ""}

Return exactly:
{
  "conciseSummary": "2-3 sentence summary of the decision and its implications",
  "hiddenAssumptions": ["assumptions being made that might not be true"],
  "risks": ["risks that might not be obvious"],
  "nextReviewQuestions": ["questions to ask when reviewing this decision later"]
}

Respond with ONLY the JSON object.`;
}

export async function summarizeDecision(
  decision: Decision
): Promise<AIResult<DecisionSummary> | { error: string }> {
  const result = await callAI<DecisionSummary>({
    taskType: "summarize-decision",
    prompt: buildPrompt(decision),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: decision,
    temperature: 0.2,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Decision summary failed" };
  }

  const validation = validateAIOutput(DecisionSummarySchema, result.data);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: 0.8 },
    rawInput: decision,
    rawOutput: result.rawOutput,
  };
}