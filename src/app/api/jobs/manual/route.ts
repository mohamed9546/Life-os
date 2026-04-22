import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireAppUser } from "@/lib/auth/session";
import { saveToInbox } from "@/lib/jobs/storage";
import { generateDedupeKey } from "@/lib/jobs/sources";
import { EnrichedJob, JobFitEvaluation, ParsedJobPosting } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      rawText?: string;
      parsed?: ParsedJobPosting;
      evaluation?: JobFitEvaluation | null;
    };

    if (!body.parsed) {
      return NextResponse.json(
        { error: "parsed job data is required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const raw = {
      source: "manual",
      company: body.parsed.company,
      title: body.parsed.title,
      location: body.parsed.location,
      salaryText: body.parsed.salaryText || undefined,
      link: "",
      description: body.rawText,
      fetchedAt: now,
    };

    const job: EnrichedJob = {
      id: uuid(),
      raw,
      parsed: null,
      fit: null,
      status: "inbox",
      dedupeKey: generateDedupeKey(raw),
      createdAt: now,
      updatedAt: now,
    };

    if (body.parsed) {
      job.parsed = {
        data: body.parsed,
        meta: {
          model: "manual-entry",
          promptType: "manual-parse",
          timestamp: now,
          confidence: body.parsed.confidence,
          durationMs: 0,
          inputBytes: 0,
          outputBytes: 0,
          fallbackUsed: false,
          fallbackAttempted: false,
          attemptCount: 1,
          effectiveTimeoutMs: 0,
          jsonExtractionFallback: false,
        },
      };
    }

    if (body.evaluation) {
      job.fit = {
        data: body.evaluation,
        meta: {
          model: "manual-entry",
          promptType: "manual-evaluate",
          timestamp: now,
          confidence: body.evaluation.confidence,
          durationMs: 0,
          inputBytes: 0,
          outputBytes: 0,
          fallbackUsed: false,
          fallbackAttempted: false,
          attemptCount: 1,
          effectiveTimeoutMs: 0,
          jsonExtractionFallback: false,
        },
      };
    }

    await saveToInbox([job], user.id);

    return NextResponse.json({ success: true, job });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save manual job" },
      { status: 500 }
    );
  }
}
