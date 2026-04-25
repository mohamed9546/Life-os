import { EnrichedJob, OutreachStrategy } from "@/types";
import { buildContactStrategy } from "@/lib/enrichment";
import { getBestContact } from "@/lib/jobs/selectors";
import { updateStoredJob } from "@/lib/jobs/storage";
import { inferHiringEmailForJob } from "./contact-email";
import { createGmailDraft, getGmailSentStyleSamples } from "./gmail";

export interface ColdOutreachDraftResult {
  draftId: string | null;
  detail: string;
  contactName?: string;
  contactEmail?: string;
  outreachStrategy?: OutreachStrategy | null;
}

export async function draftColdOutreachForJob(
  userId: string,
  job: EnrichedJob
): Promise<ColdOutreachDraftResult> {
  if (!job.parsed?.data || !job.fit?.data) {
    return {
      draftId: null,
      detail: "Cold outreach skipped: job needs parsed role and fit data first.",
    };
  }

  const styleSamples = await getGmailSentStyleSamples({ maxMessages: 8 }).catch(() => []);
  const strategy = await buildContactStrategy(job.raw, job.parsed.data, job.fit.data, {
    forceCompanyIntel: true,
    forceDecisionMakers: true,
    forceEmails: true,
    forceOutreach: true,
    ignoreThresholds: true,
    writingStyleSamples: styleSamples,
  });

  const enrichedJob: EnrichedJob = {
    ...job,
    companyIntel: strategy.companyIntel ?? job.companyIntel ?? null,
    decisionMakers: strategy.decisionMakers.length
      ? strategy.decisionMakers
      : job.decisionMakers || [],
    outreachStrategy: strategy.outreachStrategy ?? job.outreachStrategy ?? null,
  };

  await updateStoredJob(
    job.id,
    (current) => ({
      ...current,
      companyIntel: enrichedJob.companyIntel,
      decisionMakers: enrichedJob.decisionMakers,
      outreachStrategy: enrichedJob.outreachStrategy,
      updatedAt: new Date().toISOString(),
    }),
    userId
  );

  const contact = getBestContact(enrichedJob);
  if (!contact?.email) {
    const inferredHiringEmail = inferHiringEmailForJob(enrichedJob, contact?.title);
    return {
      draftId: null,
      detail: inferredHiringEmail
        ? `No verified person email was found, so the application draft will target ${inferredHiringEmail}.`
        : "Cold outreach planned, but no verified contact email was found.",
      contactName: contact?.fullName || contact?.title || "Hiring Team",
      contactEmail: inferredHiringEmail || undefined,
      outreachStrategy: enrichedJob.outreachStrategy,
    };
  }

  const body =
    enrichedJob.outreachStrategy?.emailDraft ||
    buildFallbackColdEmail(enrichedJob, contact.fullName);
  const draft = await createGmailDraft({
    to: contact.email,
    subject: buildSubject(enrichedJob),
    body,
  });

  return {
    draftId: draft.draftId,
    detail: draft.draftId
      ? `Cold outreach Gmail draft created for ${contact.fullName}.`
      : draft.error || "Cold outreach draft could not be created.",
    contactName: contact.fullName,
    contactEmail: contact.email,
    outreachStrategy: enrichedJob.outreachStrategy,
  };
}

function buildSubject(job: EnrichedJob): string {
  return `Question about ${job.raw.title} at ${job.raw.company}`;
}

function buildFallbackColdEmail(job: EnrichedJob, contactName: string): string {
  const firstName = contactName.split(/\s+/)[0] || "there";
  const track = job.parsed?.data.roleTrack || "clinical";
  return [
    `Hi ${firstName},`,
    "",
    `I saw the ${job.raw.title} role at ${job.raw.company} and thought it looked closely aligned with my background in ${track}, pharmaceutical operations, and regulated documentation.`,
    "",
    "I would be grateful to know whether you are the right person to contact about this role, or if there is someone else on the team I should speak with.",
    "",
    "Kind regards,",
    "Mohamed",
  ].join("\n");
}
