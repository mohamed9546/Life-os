import path from "path";
import {
  buildAppsStatus,
  opencodePath,
  readJsonFile,
  saveOpenCodeJson,
  saveOpenCodeText,
  slugify,
} from "./lib.mjs";

const today = new Date().toISOString().slice(0, 10);
const statePath = opencodePath("followup-state.json");
const state = await readJsonFile(statePath, { generated: {} });
const appsStatus = await buildAppsStatus();
const due = appsStatus.candidates.filter((item) => item.followUpStage && !item.ghosted);
const created = [];

for (const item of due) {
  const key = `${item.dedupeKey}:${item.followUpStage}`;
  if (state.generated[key]) {
    continue;
  }

  const subject = item.followUpStage === "second"
    ? `Second follow-up: ${item.title} application`
    : `Follow-up: ${item.title} application`;
  const body = [
    `# ${subject}`,
    ``,
    `Company: ${item.company}`,
    `Role: ${item.title}`,
    `Source: ${item.source}`,
    `Days since last action: ${item.daysSilent ?? "unknown"}`,
    ``,
    `## Draft`,
    ``,
    `Hi,`,
    ``,
    `I hope you're well. I wanted to follow up on my application for the ${item.title} role at ${item.company}. I remain very interested, especially because the role aligns closely with my CTA-first clinical trial support path and regulated documentation experience.`,
    ``,
    item.followUpStage === "second"
      ? `I realise the team may still be reviewing applications, but I would be grateful for any update you can share when convenient.`
      : `I wanted to check whether there are any updates on the hiring timeline, and I would be happy to provide any additional information if useful.`,
    ``,
    `Kind regards,`,
    `Mo`,
    ``,
  ].join("\n");

  const fileName = `${today}-${slugify(item.company)}-${slugify(item.title)}-${item.followUpStage}.md`;
  await saveOpenCodeText(path.join("drafts", "followups", fileName), body);
  state.generated[key] = fileName;
  created.push({ fileName, subject, title: item.title, company: item.company, stage: item.followUpStage });
}

await saveOpenCodeJson("followup-state.json", state);
console.log(JSON.stringify({ createdCount: created.length, created }, null, 2));
