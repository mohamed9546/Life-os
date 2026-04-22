// ============================================================
// AI module barrel export.
// Single import point for all AI functionality.
// ============================================================

export { callAI, checkAIHealth, testAIPrompt } from "./client";
export { loadAIConfig, saveAIConfig, DEFAULT_AI_CONFIG } from "./config";
export { checkAIRateLimit, recordAICall, getAIUsageStats } from "./rate-limiter";
export { parseJobPosting } from "./tasks/parse-job";
export { evaluateJobFit } from "./tasks/evaluate-job";
export { extractCandidateProfile } from "./tasks/extract-candidate-profile";
export { categorizeTransaction } from "./tasks/categorize-transaction";
export { summarizeMoneyState } from "./tasks/summarize-money";
export { summarizeDecision } from "./tasks/summarize-decision";
export { summarizeDecisionPatterns } from "./tasks/summarize-decision-patterns";
export { summarizeWeek } from "./tasks/summarize-week";
export { suggestRoutineFocus } from "./tasks/suggest-routine-focus";
export { generateFollowUpPlan } from "./tasks/generate-followup";
export { buildUserProfilePromptBlock, loadUserProfilePromptBlock } from "./user-profile";
export * from "./schemas";
