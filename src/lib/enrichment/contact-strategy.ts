import type {
  AppConfig,
  CompanyIntel,
  DecisionMaker,
  JobFitEvaluation,
  ParsedJobPosting,
  RawJobItem,
} from "@/types";
import { apolloProvider } from "./providers/apollo";
import { unwrapOrNull } from "./providers/types";
import { generateOutreachStrategy } from "./outreach-ai";
import { getAppConfig } from "@/lib/config/app-config";

export interface ContactStrategyResult {
  companyIntel: CompanyIntel | null;
  decisionMakers: DecisionMaker[];
  outreachStrategy: Awaited<ReturnType<typeof generateOutreachStrategy>>;
}

export interface ContactStrategyOptions {
  forceCompanyIntel?: boolean;
  forceDecisionMakers?: boolean;
  forceEmails?: boolean;
  forceOutreach?: boolean;
  ignoreThresholds?: boolean;
  writingStyleSamples?: string[];
}

function defaultEnrichmentConfig(): AppConfig["enrichment"] {
  return {
    apollo: { enabled: false, apiKey: "" },
    autoEnrichCompany: true,
    autoFindDecisionMakers: true,
    autoFindEmails: true,
    autoGenerateOutreach: true,
    minFitScoreForPeopleSearch: 45,
    minFitScoreForOutreach: 55,
  };
}

async function loadEnrichmentConfig(): Promise<AppConfig["enrichment"]> {
  const appConfig = await getAppConfig();
  return {
    ...defaultEnrichmentConfig(),
    ...(appConfig?.enrichment || {}),
    apollo: {
      ...defaultEnrichmentConfig().apollo,
      ...(appConfig?.enrichment?.apollo || {}),
    },
  };
}

async function backfillEmails(
  people: DecisionMaker[],
  companyDomain?: string
): Promise<DecisionMaker[]> {
  if (!companyDomain) return people;

  const updated: DecisionMaker[] = [];

  for (const person of people.slice(0, 5)) {
    if (person.email) {
      updated.push(person);
      continue;
    }
    const result = await apolloProvider.findEmail(
      person.firstName,
      person.lastName,
      companyDomain
    );
    if (result.status === "ok") {
      updated.push({
        ...person,
        email: result.data.email ?? person.email,
        emailConfidence: result.data.confidence ?? person.emailConfidence,
      });
    } else {
      if (result.status !== "not_found" && result.status !== "plan_restricted") {
        console.warn(`[contact-strategy] email lookup ${result.status} for ${person.fullName}`);
      }
      updated.push(person);
    }
  }

  if (people.length > 5) updated.push(...people.slice(5));

  return updated;
}

function inferCompanyDomain(raw: RawJobItem, companyIntel: CompanyIntel | null): string | undefined {
  if (companyIntel?.domain) {
    return companyIntel.domain;
  }

  try {
    const host = new URL(raw.link).hostname.replace(/^www\./, "").toLowerCase();
    if (/(linkedin|indeed|totaljobs|irishjobs|adzuna|reed|jooble|careerjet|serpapi|google|findwork|themuse|arbeitnow|remotive|himalayas|jobs\.nhs|nhsjobs)/.test(host)) {
      return undefined;
    }
    return host;
  } catch {
    return undefined;
  }
}

function buildFallbackDecisionMakers(
  raw: RawJobItem,
  parsed: ParsedJobPosting,
  companyIntel: CompanyIntel | null
): DecisionMaker[] {
  const companyDomain = inferCompanyDomain(raw, companyIntel);
  const country = /ireland|dublin|cork|galway|limerick/i.test(parsed.location || raw.location)
    ? "Ireland"
    : /egypt|cairo/i.test(parsed.location || raw.location)
      ? "Egypt"
      : "United Kingdom";

  const templates: Record<string, Array<{ fullName: string; title: string; departments: string[]; seniority: string }>> = {
    regulatory: [
      { fullName: "Regulatory Affairs Hiring Team", title: "Regulatory Affairs Hiring Team", departments: ["regulatory"], seniority: "manager" },
      { fullName: "Talent Acquisition Team", title: "Talent Acquisition", departments: ["human_resources"], seniority: "manager" },
    ],
    qa: [
      { fullName: "Quality Assurance Hiring Team", title: "Quality Assurance Hiring Team", departments: ["quality_assurance"], seniority: "manager" },
      { fullName: "Talent Acquisition Team", title: "Talent Acquisition", departments: ["human_resources"], seniority: "manager" },
    ],
    clinical: [
      { fullName: "Clinical Operations Hiring Team", title: "Clinical Operations Hiring Team", departments: ["operations", "medical_health"], seniority: "manager" },
      { fullName: "Talent Acquisition Team", title: "Talent Acquisition", departments: ["human_resources"], seniority: "manager" },
    ],
    medinfo: [
      { fullName: "Medical Information Hiring Team", title: "Medical Information Hiring Team", departments: ["medical_affairs"], seniority: "manager" },
      { fullName: "Talent Acquisition Team", title: "Talent Acquisition", departments: ["human_resources"], seniority: "manager" },
    ],
    other: [
      { fullName: "Hiring Team", title: "Hiring Team", departments: ["human_resources"], seniority: "manager" },
      { fullName: "Talent Acquisition Team", title: "Talent Acquisition", departments: ["human_resources"], seniority: "manager" },
    ],
  };

  const picked = templates[parsed.roleTrack] || templates.other;
  return picked.map((item, index) => ({
    id: `fallback-${raw.sourceJobId || raw.link}-${index}`,
    firstName: item.fullName.split(/\s+/)[0] || "Hiring",
    lastName: item.fullName.split(/\s+/).slice(1).join(" ") || "Team",
    fullName: item.fullName,
    title: item.title,
    company: parsed.company || raw.company,
    companyDomain,
    seniority: item.seniority,
    departments: item.departments,
    linkedinUrl: companyIntel?.linkedinUrl,
    country,
    foundAt: new Date().toISOString(),
  }));
}

export async function buildContactStrategy(
  raw: RawJobItem,
  parsed: ParsedJobPosting,
  fit: JobFitEvaluation,
  options?: ContactStrategyOptions
): Promise<ContactStrategyResult> {
  const config = await loadEnrichmentConfig();
  const opts = options ?? {};
  const apolloAvailable = config.apollo.enabled && Boolean(config.apollo.apiKey);

  const allowPeopleSearch =
    opts.ignoreThresholds || fit.fitScore >= config.minFitScoreForPeopleSearch;
  const allowOutreach =
    opts.ignoreThresholds || fit.fitScore >= config.minFitScoreForOutreach;

  let companyIntel: CompanyIntel | null = null;
  let decisionMakers: DecisionMaker[] = [];

  // ---- Company enrichment ----
  if (apolloAvailable && (config.autoEnrichCompany || opts.forceCompanyIntel)) {
    const result = await apolloProvider.enrichByName(
      parsed.company,
      parsed.location ?? raw.location
    );
    if (result.status === "ok") {
      companyIntel = result.data;
    } else if (result.status !== "not_found" && result.status !== "not_configured") {
      console.warn(`[contact-strategy] company enrichment: ${result.status}`);
    }
  }

  // ---- Decision maker search ----
  if (
    apolloAvailable &&
    (config.autoFindDecisionMakers || opts.forceDecisionMakers) &&
    allowPeopleSearch
  ) {
    const result = await apolloProvider.findDecisionMakers(
      parsed.company,
      companyIntel?.domain,
      {
        roleFamily: parsed.roleFamily,
        roleTrack: parsed.roleTrack,
        jobTitle: parsed.title,
      }
    );
    if (result.status === "ok") {
      decisionMakers = result.data;
    } else if (result.status !== "not_found" && result.status !== "not_configured") {
      console.warn(`[contact-strategy] people search: ${result.status}`);
    }

    // ---- Email backfill ----
    if (
      decisionMakers.length > 0 &&
      (config.autoFindEmails || opts.forceEmails) &&
      companyIntel?.domain
    ) {
      decisionMakers = await backfillEmails(decisionMakers, companyIntel.domain);
    }
  }

  if (decisionMakers.length === 0) {
    decisionMakers = buildFallbackDecisionMakers(raw, parsed, companyIntel);
  }

  // ---- Outreach strategy ----
  const outreachStrategy =
    (config.autoGenerateOutreach || opts.forceOutreach) && allowOutreach
      ? await generateOutreachStrategy(parsed, companyIntel, decisionMakers, {
          writingStyleSamples: opts.writingStyleSamples,
        })
      : null;

  return { companyIntel, decisionMakers, outreachStrategy };
}

// Re-export unwrapOrNull so callers don't need to import from providers directly.
export { unwrapOrNull };
