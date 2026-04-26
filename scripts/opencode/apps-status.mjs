import { buildAppsStatus, saveOpenCodeJson, saveOpenCodeText } from "./lib.mjs";

function renderMarkdown(status) {
  return [
    `# Application Status`,
    ``,
    `Generated: ${status.generatedAt}`,
    ``,
    `- Applied: ${status.totals.applied}`,
    `- Interview: ${status.totals.interview}`,
    `- Offer: ${status.totals.offer}`,
    `- Ghosted: ${status.totals.ghosted}`,
    `- Follow-up due (day 8): ${status.totals.followUpFirstDue}`,
    `- Follow-up due (day 18): ${status.totals.followUpSecondDue}`,
    ``,
    `## Queue`,
    ``,
    `| Role | Source | App | Pipeline | Fit | Days Silent |`,
    `|---|---|---|---|---:|---:|`,
    ...status.candidates.slice(0, 12).map((item) =>
      `| ${item.title} @ ${item.company} | ${item.source} | ${item.appStatus} | ${item.pipelineStatus} | ${item.fitScore ?? "-"} | ${item.daysSilent ?? "-"} |`
    ),
    ``,
  ].join("\n");
}

const status = await buildAppsStatus();
await saveOpenCodeJson("apps-status.json", status);
await saveOpenCodeText("apps-status.md", renderMarkdown(status));

console.log(JSON.stringify(status, null, 2));
