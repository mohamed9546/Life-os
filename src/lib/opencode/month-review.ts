import path from "path";
import { readCollection } from "@/lib/storage";
import { buildOpenCodeAppsStatus, OpenCodeAppsStatus } from "./apps-status";
import {
  listOpenCodeFiles,
  writeOpenCodeJson,
  writeOpenCodeText,
} from "./storage";

interface DeepWorkSession {
  date?: string;
  durationMinutes?: number;
}

interface JournalEntry {
  date?: string;
}

export interface OpenCodeMonthReview {
  generatedAt: string;
  month: string;
  metrics: {
    applicationsDrafted: number;
    applicationsApplied: number;
    interviews: number;
    offers: number;
    followUpsDue: number;
    ghosted: number;
    deepWorkHours: number;
    journalEntries: number;
    paperNotes: number;
    regulatoryDigests: number;
    shutdownEntries: number;
  };
  highlights: string[];
  appsStatus: Pick<OpenCodeAppsStatus, "totals">;
}

export async function buildOpenCodeMonthReview(
  userId: string,
  month = new Date().toISOString().slice(0, 7)
): Promise<OpenCodeMonthReview> {
  const [appsStatus, deepWork, journalEntries, paperFiles, digestFiles, dailyFiles] =
    await Promise.all([
      buildOpenCodeAppsStatus(userId),
      readCollection<DeepWorkSession>("deep-work-sessions"),
      readCollection<JournalEntry>("journal"),
      listOpenCodeFiles(path.join("notes", "papers")),
      listOpenCodeFiles(path.join("digests", "regulatory")),
      listOpenCodeFiles("daily"),
    ]);

  const deepWorkHours = deepWork
    .filter((session) => String(session.date || "").startsWith(month))
    .reduce((sum, session) => sum + (session.durationMinutes || 0), 0) / 60;

  const journalCount = journalEntries.filter((entry) => String(entry.date || "").startsWith(month)).length;
  const paperCount = paperFiles.filter(isInMonth(month)).length;
  const digestCount = digestFiles.filter(isInMonth(month)).length;
  const shutdownCount = dailyFiles.filter(isInMonth(month)).length;

  const review: OpenCodeMonthReview = {
    generatedAt: new Date().toISOString(),
    month,
    metrics: {
      applicationsDrafted: appsStatus.totals.drafted,
      applicationsApplied: appsStatus.totals.applied,
      interviews: appsStatus.totals.interview,
      offers: appsStatus.totals.offer,
      followUpsDue: appsStatus.totals.followUpFirstDue + appsStatus.totals.followUpSecondDue,
      ghosted: appsStatus.totals.ghosted,
      deepWorkHours: Number(deepWorkHours.toFixed(1)),
      journalEntries: journalCount,
      paperNotes: paperCount,
      regulatoryDigests: digestCount,
      shutdownEntries: shutdownCount,
    },
    highlights: buildHighlights(appsStatus, {
      deepWorkHours,
      journalCount,
      paperCount,
      digestCount,
      shutdownCount,
    }),
    appsStatus: { totals: appsStatus.totals },
  };

  await writeOpenCodeJson(`reviews/${month}.json`, review);
  await writeOpenCodeJson("month-review.json", review);
  await writeOpenCodeText("month-review.md", renderOpenCodeMonthReviewMarkdown(review));
  return review;
}

function buildHighlights(
  appsStatus: OpenCodeAppsStatus,
  metrics: {
    deepWorkHours: number;
    journalCount: number;
    paperCount: number;
    digestCount: number;
    shutdownCount: number;
  }
): string[] {
  const highlights: string[] = [];
  if (appsStatus.totals.followUpSecondDue > 0) {
    highlights.push(`${appsStatus.totals.followUpSecondDue} applications need a second follow-up.`);
  }
  if (appsStatus.totals.interview > 0 || appsStatus.totals.offer > 0) {
    highlights.push(`Pipeline has ${appsStatus.totals.interview} interview-stage and ${appsStatus.totals.offer} offer-stage roles.`);
  }
  if (metrics.deepWorkHours < 10) {
    highlights.push(`Deep work is at ${metrics.deepWorkHours.toFixed(1)}h this month — protect more CTA-tailoring blocks.`);
  }
  if (metrics.paperCount > 0 || metrics.digestCount > 0) {
    highlights.push(`Knowledge intake logged ${metrics.paperCount} paper notes and ${metrics.digestCount} regulatory digests.`);
  }
  if (metrics.shutdownCount === 0) {
    highlights.push("No shutdown entries recorded this month yet.");
  }
  if (highlights.length === 0) {
    highlights.push("System is stable; maintain CTA-first application throughput and follow-up cadence.");
  }
  return highlights;
}

function renderOpenCodeMonthReviewMarkdown(review: OpenCodeMonthReview): string {
  return [
    `# Month Review ${review.month}`,
    ``,
    `Generated: ${review.generatedAt}`,
    ``,
    `## Metrics`,
    ``,
    `- Applications drafted: ${review.metrics.applicationsDrafted}`,
    `- Applications applied: ${review.metrics.applicationsApplied}`,
    `- Interviews: ${review.metrics.interviews}`,
    `- Offers: ${review.metrics.offers}`,
    `- Follow-ups due: ${review.metrics.followUpsDue}`,
    `- Ghosted: ${review.metrics.ghosted}`,
    `- Deep work hours: ${review.metrics.deepWorkHours}`,
    `- Journal entries: ${review.metrics.journalEntries}`,
    `- Paper notes: ${review.metrics.paperNotes}`,
    `- Regulatory digests: ${review.metrics.regulatoryDigests}`,
    `- Shutdown entries: ${review.metrics.shutdownEntries}`,
    ``,
    `## Highlights`,
    ``,
    ...review.highlights.map((item) => `- ${item}`),
    ``,
  ].join("\n");
}

function isInMonth(month: string) {
  const monthPrefix = month;
  return (filePath: string) => {
    const fileName = path.basename(filePath);
    if (fileName.includes(monthPrefix)) {
      return true;
    }
    return false;
  };
}
