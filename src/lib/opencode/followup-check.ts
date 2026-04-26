import path from "path";
import { buildOpenCodeAppsStatus } from "./apps-status";
import { readOpenCodeJson, writeOpenCodeJson, writeOpenCodeText } from "./storage";

export async function generateFollowUpDrafts(userId: string): Promise<{
  createdCount: number;
  created: Array<{ fileName: string; subject: string; title: string; company: string; stage: "first" | "second" }>;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const state = await readOpenCodeJson<{ generated: Record<string, string> }>("followup-state.json", { generated: {} });
  const appsStatus = await buildOpenCodeAppsStatus(userId);
  const due = appsStatus.candidates.filter((item) => item.followUpStage && !item.ghosted);
  const created: Array<{ fileName: string; subject: string; title: string; company: string; stage: "first" | "second" }> = [];

  for (const item of due) {
    if (!item.followUpStage) continue;
    const key = `${item.dedupeKey}:${item.followUpStage}`;
    if (state.generated[key]) continue;

    const subject = item.followUpStage === "second"
      ? `Second follow-up: ${item.title} application`
      : `Follow-up: ${item.title} application`;
    const body = [
      `# ${subject}`,
      ``,
      `Company: ${item.company}`,
      `Role: ${item.title}`,
      `Source: ${item.sourceLabel}`,
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
    await writeOpenCodeText(path.join("drafts", "followups", fileName), body);
    state.generated[key] = fileName;
    created.push({ fileName, subject, title: item.title, company: item.company, stage: item.followUpStage });
  }

  await writeOpenCodeJson("followup-state.json", state);
  return { createdCount: created.length, created };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
