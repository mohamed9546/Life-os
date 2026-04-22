import {
  DecisionMaker,
  EnrichedJob,
  JobContactState,
  JobRankingState,
} from "@/types";

const STALE_CONTACT_DAYS = 14;

function scoreContact(contact: DecisionMaker): number {
  const title = contact.title.toLowerCase();
  const departments = (contact.departments || []).join(" ").toLowerCase();

  let score = 0;

  if (contact.email) score += 40;
  if (contact.emailConfidence === "high") score += 10;
  if (title.includes("hiring manager")) score += 30;
  if (title.includes("recruit")) score += 25;
  if (title.includes("talent")) score += 20;
  if (title.includes("manager")) score += 15;
  if (title.includes("director") || title.includes("head")) score += 10;
  if (departments.includes("human_resources")) score += 10;
  if (departments.includes("operations") || departments.includes("medical_health")) {
    score += 8;
  }

  return score;
}

export function getBestContact(job: EnrichedJob): DecisionMaker | null {
  const contacts = job.decisionMakers || [];
  if (contacts.length === 0) {
    return null;
  }

  return [...contacts].sort((left, right) => {
    const scoreDiff = scoreContact(right) - scoreContact(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return right.foundAt.localeCompare(left.foundAt);
  })[0];
}

export function hasOutreachDraft(job: EnrichedJob): boolean {
  return Boolean(
    job.outreachStrategy?.emailDraft || job.outreachStrategy?.linkedinMessageDraft
  );
}

export function getContactFreshness(job: EnrichedJob): {
  isStale: boolean;
  ageDays: number | null;
} {
  const bestContact = getBestContact(job);
  if (!bestContact?.foundAt) {
    return { isStale: false, ageDays: null };
  }

  const ageDays = Math.floor(
    (Date.now() - new Date(bestContact.foundAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    isStale: ageDays >= STALE_CONTACT_DAYS,
    ageDays,
  };
}

export function getJobContactState(job: EnrichedJob): JobContactState {
  const bestContact = getBestContact(job);
  const freshness = getContactFreshness(job);

  if (freshness.isStale && bestContact) {
    return "Stale contacts";
  }

  if (hasOutreachDraft(job)) {
    return "Outreach draft ready";
  }

  if (bestContact?.email) {
    return "Email ready";
  }

  if ((job.decisionMakers?.length || 0) > 0) {
    return "Contacts found";
  }

  return "No contacts yet";
}

export function getJobRankingState(job: EnrichedJob): JobRankingState {
  if (job.parsed?.data && job.fit?.data) {
    return "AI fit + ranked";
  }

  if (job.parsed?.data && !job.fit?.data) {
    return "Parse only";
  }

  if (!job.parsed?.data && job.fit?.data) {
    return "Ranking degraded";
  }

  return "No fit score yet";
}

export function dedupeJobsById(jobs: EnrichedJob[]): EnrichedJob[] {
  const seen = new Map<string, EnrichedJob>();

  for (const job of jobs) {
    const existing = seen.get(job.id);
    if (!existing || existing.updatedAt < job.updatedAt) {
      seen.set(job.id, job);
    }
  }

  return Array.from(seen.values());
}
