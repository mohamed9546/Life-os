import { buildOpenCodeAppsStatus } from "./apps-status";
import { readOpenCodeText } from "./storage";

function parseMarkdownTasks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line) || /^-\s+\[[ xX]?\]\s+/.test(line))
    .map((line) => line.replace(/^-\s+(\[[ xX]?\]\s+)?/, "").trim())
    .filter(Boolean);
}

export async function getNextAction(userId: string, energy: number): Promise<{ next: string; reason: string }> {
  const [tasksText, tomorrowText, appsStatus] = await Promise.all([
    readOpenCodeText("tasks.md", "# Tasks\n\n- Review CTA shortlist\n"),
    readOpenCodeText("tomorrow.md", "# Tomorrow\n\n## Top 3\n- Review CTA shortlist\n"),
    buildOpenCodeAppsStatus(userId),
  ]);

  const taskCandidates = parseMarkdownTasks(tasksText);
  const tomorrowCandidates = parseMarkdownTasks(tomorrowText).slice(0, 3);
  const secondFollowUp = appsStatus.candidates.find((item) => item.followUpStage === "second");
  const firstFollowUp = appsStatus.candidates.find((item) => item.followUpStage === "first");

  if (secondFollowUp) {
    return {
      next: `Send second follow-up for ${secondFollowUp.title} at ${secondFollowUp.company}`,
      reason: "A second follow-up is overdue and has the highest response-leverage right now.",
    };
  }

  if (firstFollowUp) {
    return {
      next: `Send first follow-up for ${firstFollowUp.title} at ${firstFollowUp.company}`,
      reason: "A first follow-up is due and prevents the application from drifting into silence.",
    };
  }

  if (energy >= 4 && tomorrowCandidates.length > 0) {
    return {
      next: tomorrowCandidates[0],
      reason: "Energy is high enough for the top planned priority.",
    };
  }

  if (energy <= 2 && taskCandidates.length > 1) {
    return {
      next: taskCandidates[taskCandidates.length - 1],
      reason: "Energy is low, so a lighter admin or maintenance task is the safest next move.",
    };
  }

  return {
    next: tomorrowCandidates[0] || taskCandidates[0] || "Protect one CTA-focused block",
    reason: "Best available planned priority.",
  };
}
