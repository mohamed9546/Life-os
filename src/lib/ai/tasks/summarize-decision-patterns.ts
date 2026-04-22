import { AIResult, Decision, DecisionPatternReview } from "@/types";
import { callAI } from "../client";
import {
  DecisionPatternReviewSchema,
  validateAIOutput,
} from "../schemas";

const SYSTEM_PROMPT = `You analyze clusters of decisions inside a local-first personal operating system.
Look for repeated assumptions, recurring risks, avoidance loops, and useful review habits.
Return valid JSON only.`;

function buildPrompt(decisions: Decision[]): string {
  return `Analyze the pattern across these decisions.

${decisions
    .slice(0, 12)
    .map(
      (decision, index) => `Decision ${index + 1}
- Title: ${decision.title}
- Status: ${decision.status}
- Context: ${decision.context}
- Options: ${decision.options.join(", ")}
- Chosen: ${decision.chosenOption || "not decided"}
- Outcome: ${decision.outcome || "not recorded"}`
    )
    .join("\n\n")}

Return exactly:
{
  "repeatedAssumptions": ["string"],
  "commonRiskThemes": ["string"],
  "avoidanceLoops": ["string"],
  "reviewChecklist": ["string"],
  "narrativeSummary": "string",
  "confidence": 0.0
}`;
}

export async function summarizeDecisionPatterns(
  decisions: Decision[]
): Promise<AIResult<DecisionPatternReview> | { error: string }> {
  const result = await callAI<DecisionPatternReview>({
    taskType: "summarize-decision-patterns",
    prompt: buildPrompt(decisions),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: decisions,
    temperature: 0.2,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Decision pattern review failed" };
  }

  const validation = validateAIOutput(DecisionPatternReviewSchema, result.data);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: validation.data.confidence },
    rawInput: decisions,
    rawOutput: result.rawOutput,
  };
}
