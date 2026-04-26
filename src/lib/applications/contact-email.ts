import { EnrichedJob } from "@/types";

const JOB_BOARD_HOST_PATTERN =
  /(linkedin|indeed|totaljobs|irishjobs|adzuna|reed|jooble|careerjet|serpapi|google|findwork|themuse|arbeitnow|remotive|himalayas|jobsac|guardianjobs|jobs\.nhs|nhsjobs)/i;

function preferredAliases(contactTitle?: string): string[] {
  const title = (contactTitle || "").toLowerCase();
  if (/talent|recruit/i.test(title)) {
    return ["recruitment", "careers", "talent", "jobs", "hr", "hiring"];
  }
  return ["careers", "jobs", "recruitment", "talent", "hr", "hiring"];
}

export function inferCompanyDomainFromJob(
  job: Pick<EnrichedJob, "raw" | "companyIntel">
): string | null {
  const domain = job.companyIntel?.domain?.trim().toLowerCase();
  if (domain) return domain;

  try {
    const host = new URL(job.raw.link).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || JOB_BOARD_HOST_PATTERN.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function inferHiringEmailForJob(
  job: Pick<EnrichedJob, "raw" | "companyIntel">,
  contactTitle?: string
): string | null {
  const domain = inferCompanyDomainFromJob(job);
  if (!domain) return null;

  return `${preferredAliases(contactTitle)[0]}@${domain}`;
}
