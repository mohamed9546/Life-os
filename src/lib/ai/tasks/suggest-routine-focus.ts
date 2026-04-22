import { AIResult, RoutineAnalytics } from "@/types";
import { callAI } from "../client";
import { RoutineFocusSchema, validateAIOutput } from "../schemas";

const SYSTEM_PROMPT = `You are a personal operating system routine coach.
Turn routine consistency data into one focused next action and clear skipped-loop warnings.
Return valid JSON only.`;

function buildPrompt(input: RoutineAnalytics): string {
  return `Analyze this routine analytics state and return JSON only.

Consistency score: ${input.consistencyScore}
Completed last 7 days: ${input.completedLast7Days}
Skipped last 7 days: ${input.skippedLast7Days}
Due today: ${input.dueToday}
Area balance:
${input.areaBalance
    .map(
      (item) =>
        `- ${item.area}: enabled ${item.enabled}, completed last 7 days ${item.completedLast7Days}`
    )
    .join("\n")}

Current skipped-loop warnings:
${input.skippedLoopWarnings.map((item) => `- ${item}`).join("\n") || "- None"}

Return exactly:
{
  "consistencyScore": 0,
  "skippedLoopWarnings": ["string"],
  "nextBestAction": "string"
}`;
}

export async function suggestRoutineFocus(
  input: RoutineAnalytics
): Promise<AIResult<Pick<RoutineAnalytics, "consistencyScore" | "skippedLoopWarnings" | "nextBestAction">> | { error: string }> {
  const result = await callAI<
    Pick<RoutineAnalytics, "consistencyScore" | "skippedLoopWarnings" | "nextBestAction">
  >({
    taskType: "suggest-routine-focus",
    prompt: buildPrompt(input),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: input,
    temperature: 0.25,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Routine focus suggestion failed" };
  }

  const validation = validateAIOutput(RoutineFocusSchema, result.data);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: 0.75 },
    rawInput: input,
    rawOutput: result.rawOutput,
  };
}
