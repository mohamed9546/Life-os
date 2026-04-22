import { summarizeDecisionPatterns } from "@/lib/ai";
import { getDecisions } from "@/lib/decisions/storage";
import { saveDecisionPatternReview } from "@/lib/decisions/pattern-storage";

export async function generateDecisionPatternReview(userId: string) {
  const decisions = await getDecisions(userId);
  if (decisions.length === 0) {
    return { error: "Add some decisions before generating a pattern review." };
  }

  const result = await summarizeDecisionPatterns(decisions);
  if ("error" in result) {
    return result;
  }

  const saved = await saveDecisionPatternReview(
    {
      review: result,
      input: decisions.map((decision) => ({
        id: decision.id,
        title: decision.title,
        status: decision.status,
      })),
    },
    userId
  );

  return {
    result,
    saved,
  };
}
