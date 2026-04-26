import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { buildAppsStatus, opencodePath, parseMarkdownTasks, readTextFile, writeTextFile } from "./lib.mjs";

const rl = readline.createInterface({ input, output });
const energyRaw = await rl.question("Current energy (1-5): ");
await rl.close();

const energy = Math.max(1, Math.min(5, parseInt(energyRaw || "3", 10) || 3));
const tasksPath = opencodePath("tasks.md");
const tomorrowPath = opencodePath("tomorrow.md");

const tasksText = await readTextFile(
  tasksPath,
  "# Tasks\n\n## Active\n- [ ] Review CTA shortlist\n\n## Backlog\n- [ ] Update STAR stories\n"
);
await writeTextFile(tasksPath, tasksText);

const tomorrowText = await readTextFile(tomorrowPath, "# Tomorrow\n\n## Top 3\n- Review CTA shortlist\n");
const appsStatus = await buildAppsStatus();

const taskCandidates = parseMarkdownTasks(tasksText);
const tomorrowCandidates = parseMarkdownTasks(tomorrowText).slice(0, 3);
const firstSecondFollowUp = appsStatus.candidates.find((item) => item.followUpStage === "second");
const firstFirstFollowUp = appsStatus.candidates.find((item) => item.followUpStage === "first");
const topTomorrow = tomorrowCandidates[0] || taskCandidates[0] || "Protect one CTA-focused block";

let nextAction = topTomorrow;
let reason = "Best available planned priority.";

if (firstSecondFollowUp) {
  nextAction = `Send second follow-up for ${firstSecondFollowUp.title} at ${firstSecondFollowUp.company}`;
  reason = "A second follow-up is overdue and has the highest response-leverage right now.";
} else if (firstFirstFollowUp) {
  nextAction = `Send first follow-up for ${firstFirstFollowUp.title} at ${firstFirstFollowUp.company}`;
  reason = "A first follow-up is due and prevents the application from drifting into silence.";
} else if (energy >= 4 && tomorrowCandidates.length > 0) {
  nextAction = tomorrowCandidates[0];
  reason = "Energy is high enough for the top planned priority.";
} else if (energy <= 2 && taskCandidates.length > 1) {
  nextAction = taskCandidates[taskCandidates.length - 1];
  reason = "Energy is low, so pick a lighter admin or maintenance task.";
}

output.write(`\nNext: ${nextAction}\n`);
output.write(`Why: ${reason}\n`);
