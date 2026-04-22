import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireAppUser } from "@/lib/auth/session";
import { evaluateJobFit } from "@/lib/ai/tasks/evaluate-job";
import { parseJobPosting } from "@/lib/ai/tasks/parse-job";
import { saveImportRecord } from "@/lib/imports/storage";
import { coerceJobImports, parseJsonArrayPayload } from "@/lib/imports/parsers";
import { linkedInAlertJobsToRaw, parseLinkedInAlertText } from "@/lib/jobs/sources/linkedin";
import { generateDedupeKey } from "@/lib/jobs/sources";
import { enrichSingleRawJob } from "@/lib/jobs/pipeline";
import { PIPELINE_ENRICHMENT_BUDGETS } from "@/lib/jobs/pipeline/config";
import { saveRawJobs, saveToInbox } from "@/lib/jobs/storage";
import { EnrichedJob } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireAppUser();
  let operationType: "jobs-json" | "jobs-text" = "jobs-text";

  try {
    const body = await request.json();
    const { mode, input } = body as {
      mode?: "json" | "text";
      input?: string;
    };

    if (!mode || !input?.trim()) {
      return NextResponse.json(
        { error: "mode and input are required" },
        { status: 400 }
      );
    }

    if (mode === "json") {
      operationType = "jobs-json";
      const items = parseJsonArrayPayload(input);
      const rawJobs = coerceJobImports(items);
      if (rawJobs.length === 0) {
        return NextResponse.json(
          { error: "No usable job items were found in the JSON payload" },
          { status: 400 }
        );
      }

      await saveRawJobs(rawJobs, user.id);

      const enrichedJobs: EnrichedJob[] = [];
      for (const rawJob of rawJobs.slice(0, PIPELINE_ENRICHMENT_BUDGETS.jsonImport)) {
        try {
          enrichedJobs.push(await enrichSingleRawJob(rawJob));
        } catch {
          // Keep going so one bad item does not fail the full import.
        }
      }

      if (enrichedJobs.length > 0) {
        await saveToInbox(enrichedJobs.filter((job) => job.status !== "rejected"), user.id);
      }

      const record = await saveImportRecord(
        {
          type: "jobs-json",
          label: "JSON job import",
          status: enrichedJobs.length > 0 ? "success" : "failed",
          counts: {
            received: items.length,
            imported: enrichedJobs.length,
            failed: items.length - enrichedJobs.length,
          },
          summary:
            items.length > PIPELINE_ENRICHMENT_BUDGETS.jsonImport
              ? `Imported and enriched the first ${enrichedJobs.length} jobs to keep local AI throughput responsive.`
              : `Imported ${enrichedJobs.length} jobs into the AI inbox.`,
        },
        user.id
      );

      return NextResponse.json({
        success: true,
        record,
        imported: enrichedJobs.length,
        received: items.length,
      });
    }

    const alertJobs = parseLinkedInAlertText(input);
    let importedJobs: EnrichedJob[] = [];

    if (alertJobs.length > 0) {
      const rawJobs = linkedInAlertJobsToRaw(alertJobs);
      await saveRawJobs(rawJobs, user.id);

      for (const rawJob of rawJobs.slice(0, PIPELINE_ENRICHMENT_BUDGETS.textImport)) {
        importedJobs.push(await enrichSingleRawJob(rawJob));
      }
    } else {
      const parseResult = await parseJobPosting(input);
      if ("error" in parseResult) {
        throw new Error(parseResult.error);
      }

      const evaluateResult = await evaluateJobFit(parseResult.data);
      const now = new Date().toISOString();
      const raw = {
        source: "import-text",
        company: parseResult.data.company,
        title: parseResult.data.title,
        location: parseResult.data.location,
        salaryText: parseResult.data.salaryText || undefined,
        link: "",
        description: input,
        fetchedAt: now,
      };

      const fit = "error" in evaluateResult ? null : evaluateResult;

      importedJobs = [
        {
          id: uuid(),
          raw,
          parsed: parseResult,
          fit,
          status: fit?.data.priorityBand === "reject" ? "rejected" : "inbox",
          dedupeKey: generateDedupeKey(raw),
          createdAt: now,
          updatedAt: now,
        },
      ];

      await saveRawJobs([raw], user.id);
    }

    if (importedJobs.length > 0) {
      await saveToInbox(importedJobs.filter((job) => job.status !== "rejected"), user.id);
    }

    const record = await saveImportRecord(
      {
        type: "jobs-text",
        label: alertJobs.length > 0 ? "Job alert text import" : "Raw job text import",
        status: importedJobs.length > 0 ? "success" : "failed",
        counts: {
          received: alertJobs.length > 0 ? alertJobs.length : 1,
          imported: importedJobs.length,
          failed: 0,
        },
        summary:
          alertJobs.length > 0
            ? `Converted ${importedJobs.length} alert entries into inbox jobs.`
            : "Parsed the pasted job text and sent it into the Career inbox.",
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      record,
      imported: importedJobs.length,
      jobs: importedJobs,
    });
  } catch (err) {
    await saveImportRecord(
      {
        type: operationType,
        label: "Job import failed",
        status: "failed",
        counts: {
          received: 0,
          imported: 0,
          failed: 1,
        },
        summary: err instanceof Error ? err.message : "Job import failed",
      },
      user.id
    );

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import jobs" },
      { status: 500 }
    );
  }
}
