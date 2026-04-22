import { NextRequest, NextResponse } from "next/server";
import {
  getJobById,
  markApplied,
  rejectJob,
  trackJob,
  updateStoredJob,
  unrejectJob,
} from "@/lib/jobs/storage";
import { requireAppUser } from "@/lib/auth/session";
import { buildContactStrategy } from "@/lib/enrichment";
import { enrichSingleRawJob } from "@/lib/jobs/pipeline";
import { evaluateJobFit } from "@/lib/ai/tasks/evaluate-job";

export const dynamic = "force-dynamic";

type JobRefreshAction =
  | "refresh-intel"
  | "refresh-contacts"
  | "refresh-outreach"
  | "rerun-parse"
  | "rerun-fit";

async function refreshJobEnrichment(
  id: string,
  userId: string,
  action: JobRefreshAction
): Promise<boolean> {
  const existing = await getJobById(id, userId);
  if (!existing) {
    return false;
  }

  if (action === "rerun-parse") {
    const rebuilt = await enrichSingleRawJob(existing.raw);
    return updateStoredJob(
      id,
      (current) => ({
        ...current,
        parsed: rebuilt.parsed,
        fit: rebuilt.fit ?? current.fit,
        dedupeKey: rebuilt.dedupeKey,
        status:
          rebuilt.fit?.data?.priorityBand === "reject" ? "rejected" : current.status,
        updatedAt: new Date().toISOString(),
      }),
      userId
    );
  }

  if (action === "rerun-fit") {
    const workingJob = existing.parsed?.data
      ? existing
      : {
          ...existing,
          ...(await enrichSingleRawJob(existing.raw)),
        };

    if (!workingJob.parsed?.data) {
      throw new Error("This job could not be parsed well enough to re-run fit.");
    }

    const fitResult = await evaluateJobFit(workingJob.parsed.data);
    if ("error" in fitResult) {
      throw new Error(fitResult.error);
    }

    return updateStoredJob(
      id,
      (current) => ({
        ...current,
        parsed: workingJob.parsed,
        fit: fitResult,
        status: fitResult.data.priorityBand === "reject" ? "rejected" : current.status,
        updatedAt: new Date().toISOString(),
      }),
      userId
    );
  }

  let workingJob = existing;
  if (!workingJob.parsed?.data || !workingJob.fit?.data) {
    const rebuilt = await enrichSingleRawJob(workingJob.raw);
    workingJob = {
      ...workingJob,
      parsed: rebuilt.parsed,
      fit: rebuilt.fit,
      dedupeKey: rebuilt.dedupeKey,
    };
  }

  if (!workingJob.parsed?.data || !workingJob.fit?.data) {
    throw new Error("This job could not be enriched enough to refresh intel.");
  }

  const strategy = await buildContactStrategy(
    workingJob.raw,
    workingJob.parsed.data,
    workingJob.fit.data,
    {
      forceCompanyIntel: true,
      forceDecisionMakers:
        action === "refresh-contacts" || action === "refresh-outreach",
      forceEmails: action === "refresh-contacts" || action === "refresh-outreach",
      forceOutreach: action === "refresh-outreach",
      ignoreThresholds: true,
    }
  );

  return updateStoredJob(
    id,
    (current) => ({
      ...current,
      parsed: workingJob.parsed,
      fit: workingJob.fit,
      dedupeKey: workingJob.dedupeKey,
      companyIntel: strategy.companyIntel ?? current.companyIntel ?? null,
      decisionMakers:
        action === "refresh-contacts" || action === "refresh-outreach"
          ? strategy.decisionMakers.length > 0
            ? strategy.decisionMakers
            : current.decisionMakers || []
          : current.decisionMakers || [],
      outreachStrategy:
        action === "refresh-outreach"
          ? strategy.outreachStrategy ?? current.outreachStrategy ?? null
          : current.outreachStrategy ?? null,
      updatedAt: new Date().toISOString(),
    }),
    userId
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const { action, id } = body as { action?: string; id?: string };

    if (!action || !id) {
      return NextResponse.json(
        { error: "action and id are required" },
        { status: 400 }
      );
    }

    let success = false;

    switch (action) {
      case "track":
        success = await trackJob(id, user.id);
        break;
      case "reject":
        success = await rejectJob(id, user.id);
        break;
      case "unreject":
        success = await unrejectJob(id, user.id);
        break;
      case "apply":
        success = await markApplied(id, user.id);
        break;
      case "refresh-intel":
      case "refresh-contacts":
      case "refresh-outreach":
      case "rerun-parse":
      case "rerun-fit":
        success = await refreshJobEnrichment(id, user.id, action);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success, action, id });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Action failed",
      },
      { status: 500 }
    );
  }
}
