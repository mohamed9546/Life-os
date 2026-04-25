import { readObject, ConfigFiles } from "@/lib/storage";
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
  const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
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

export async function buildContactStrategy(
  raw: RawJobItem,
  parsed: ParsedJobPosting,
  fit: JobFitEvaluation,
  options?: ContactStrategyOptions
): Promise<ContactStrategyResult> {
  const config = await loadEnrichmentConfig();
  const opts = options ?? {};

  // Apollo must be configured and enabled — it's an optional power-up, not core.
  if (!config.apollo.enabled || !config.apollo.apiKey) {
    return { companyIntel: null, decisionMakers: [], outreachStrategy: null };
  }

  const allowPeopleSearch =
    opts.ignoreThresholds || fit.fitScore >= config.minFitScoreForPeopleSearch;
  const allowOutreach =
    opts.ignoreThresholds || fit.fitScore >= config.minFitScoreForOutreach;

  let companyIntel: CompanyIntel | null = null;
  let decisionMakers: DecisionMaker[] = [];

  // ---- Company enrichment ----
  if (config.autoEnrichCompany || opts.forceCompanyIntel) {
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
  if ((config.autoFindDecisionMakers || opts.forceDecisionMakers) && allowPeopleSearch) {
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
