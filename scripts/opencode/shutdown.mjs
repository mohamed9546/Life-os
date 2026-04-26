import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { appendTextFile, opencodePath, writeJsonFile, writeTextFile } from "./lib.mjs";

const rl = readline.createInterface({ input, output });

function splitList(value) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

const today = new Date().toISOString().slice(0, 10);
const wins = splitList(await rl.question("Wins (separate with |): "));
const blockers = splitList(await rl.question("Blockers (separate with |): "));
const top3 = splitList(await rl.question("Top 3 for tomorrow (separate with |): ")).slice(0, 3);
const energyRaw = await rl.question("Energy for tomorrow (1-5): ");
const notes = await rl.question("Optional notes: ");
await rl.close();

const entry = {
  date: today,
  wins,
  blockers,
  top3,
  energy: Math.max(1, Math.min(5, parseInt(energyRaw || "3", 10) || 3)),
  notes: notes.trim(),
  createdAt: new Date().toISOString(),
};

await writeJsonFile(opencodePath("daily", `${today}.json`), entry);
await writeTextFile(
  opencodePath("tomorrow.md"),
  [
    `# Tomorrow`,
    ``,
    `Date: ${today}`,
    `Energy: ${entry.energy}/5`,
    ``,
    `## Top 3`,
    ...entry.top3.map((item) => `- ${item}`),
    ``,
    `## Blockers`,
    ...(entry.blockers.length > 0 ? entry.blockers.map((item) => `- ${item}`) : ["- None recorded"]),
    ``,
    `## Notes`,
    entry.notes || "-",
    ``,
  ].join("\n")
);
await appendTextFile(
  opencodePath("daily", "shutdown-log.md"),
  [
    `## ${today}`,
    `- Wins: ${entry.wins.join("; ") || "none"}`,
    `- Blockers: ${entry.blockers.join("; ") || "none"}`,
    `- Top 3: ${entry.top3.join("; ") || "none"}`,
    `- Energy: ${entry.energy}/5`,
    entry.notes ? `- Notes: ${entry.notes}` : null,
    ``,
  ].filter(Boolean).join("\n")
);

output.write(`Saved shutdown entry for ${today}.\n`);
