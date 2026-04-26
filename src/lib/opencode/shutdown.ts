import { appendOpenCodeText, writeOpenCodeJson, writeOpenCodeText } from "./storage";

export interface ShutdownEntryInput {
  date?: string;
  wins: string[];
  blockers: string[];
  top3: string[];
  energy: number;
  notes?: string;
}

export interface ShutdownEntry extends ShutdownEntryInput {
  date: string;
  createdAt: string;
}

export async function recordShutdownEntry(input: ShutdownEntryInput): Promise<ShutdownEntry> {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const entry: ShutdownEntry = {
    date,
    wins: input.wins,
    blockers: input.blockers,
    top3: input.top3.slice(0, 3),
    energy: Math.max(1, Math.min(5, Math.round(input.energy || 3))),
    notes: input.notes?.trim() || "",
    createdAt: new Date().toISOString(),
  };

  await writeOpenCodeJson(`daily/${date}.json`, entry);
  await writeOpenCodeText(
    "tomorrow.md",
    [
      `# Tomorrow`,
      ``,
      `Date: ${date}`,
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
  await appendOpenCodeText(
    "daily/shutdown-log.md",
    [
      `## ${date}`,
      `- Wins: ${entry.wins.join("; ") || "none"}`,
      `- Blockers: ${entry.blockers.join("; ") || "none"}`,
      `- Top 3: ${entry.top3.join("; ") || "none"}`,
      `- Energy: ${entry.energy}/5`,
      entry.notes ? `- Notes: ${entry.notes}` : null,
      ``,
    ].filter(Boolean).join("\n")
  );

  return entry;
}
