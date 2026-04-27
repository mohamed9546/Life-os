// Apollo.io enrichment provider.
// Free tier: ~10,000 credits/month. People search ≈2 credits/result, company ≈1 credit.
// Apollo is optional — callers must handle all non-"ok" result states gracefully.

import type { CompanyIntel, DecisionMaker, AppConfig } from "@/types";
import { TtlCache } from "../cache";
import { CallBudget } from "../budget";
import type {
  EnrichResult,
  EmailLookupResult,
  RoleContext,
  ProviderHealth,
} from "./types";
import { getAppConfig } from "@/lib/config/app-config";

// ---- Cache TTLs ----

const COMPANY_TTL = 24 * 60 * 60 * 1_000;  // 24 h
const PEOPLE_TTL  = 12 * 60 * 60 * 1_000;  // 12 h
const EMAIL_TTL   = 24 * 60 * 60 * 1_000;  // 24 h
const HEALTH_TTL  =  5 * 60 * 1_000;       //  5 min
const HEALTH_ERR_TTL = 60 * 1_000;         //  1 min (shorter for errors)

// Module-level singletons — survive across requests in the same process.
const companyCache = new TtlCache<CompanyIntel>(COMPANY_TTL);
const peopleCache  = new TtlCache<DecisionMaker[]>(PEOPLE_TTL);
const emailCache   = new TtlCache<EmailLookupResult>(EMAIL_TTL);
const healthCache  = new TtlCache<ProviderHealth>(HEALTH_TTL);

// Free plan: 10,000 credits/month ≈ 300/day.
// Budget is conservative to protect the monthly allocation.
const budget = new CallBudget(250, {
  "mixed_people/search": 40,
  "people/match":        80,
  "organizations/enrich": 80,
  "mixed_companies/search": 40,
});

// ---- Config ----

async function getApolloKey(): Promise<string | null> {
  const config = await getAppConfig();
  if (!config?.enrichment?.apollo?.enabled || !config.enrichment.apollo.apiKey) {
    return null;
  }
  return config.enrichment.apollo.apiKey;
}

// ---- HTTP layer ----

type RawFetchResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_configured" }
  | { status: "plan_restricted"; endpoint: string }
  | { status: "auth_failed" }
  | { status: "timeout"; endpoint: string }
  | { status: "network_error"; error: string };

async function apolloPost(
  endpoint: string,
  body: Record<string, unknown>
): Promise<RawFetchResult> {
  const apiKey = await getApolloKey();
  if (!apiKey) return { status: "not_configured" };

  const budgetCheck = budget.canCall(endpoint);
  if (!budgetCheck.allowed) {
    return { status: "plan_restricted", endpoint };
  }

  try {
    const response = await fetch(`https://api.apollo.io/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    budget.record(endpoint);

    if (!response.ok) {
      if (response.status === 403) {
        const errBody = await response.json().catch(() => ({})) as { error_code?: string };
        if (errBody.error_code === "API_INACCESSIBLE") {
          return { status: "plan_restricted", endpoint };
        }
        return { status: "auth_failed" };
      }
      if (response.status === 401) {
        return { status: "auth_failed" };
      }
      console.warn(`[apollo] ${endpoint} HTTP ${response.status}`);
      return { status: "network_error", error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as Record<string, unknown>;
    return { status: "ok", data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { status: "timeout", endpoint };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "network_error", error: msg };
  }
}

// ---- Apollo shape types ----

interface ApolloOrg {
  id: string;
  name: string;
  website_url: string;
  linkedin_url: string;
  primary_domain: string;
  industry: string;
  estimated_num_employees: number;
  employee_count_range: string;
  founded_year: number;
  short_description: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  annual_revenue_printed: string;
  total_funding_printed: string;
  latest_funding_round_type: string;
  technologies: string[];
  keywords: string[];
}

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email: string;
  email_confidence: string;
  linkedin_url: string;
  organization_name: string;
  organization: { primary_domain: string };
  seniority: string;
  departments: string[];
  city: string;
  country: string;
  phone_numbers: Array<{ raw_number: string }>;
}

// ---- Mapping helpers ----

function mapOrg(org: ApolloOrg, fallbackDomain?: string): CompanyIntel {
  return {
    name: org.name || "",
    domain: org.primary_domain || fallbackDomain,
    industry: org.industry || undefined,
    employeeCount: org.estimated_num_employees
      ? String(org.estimated_num_employees)
      : undefined,
    employeeRange: org.employee_count_range || undefined,
    founded: org.founded_year ? String(org.founded_year) : undefined,
    description: org.short_description || undefined,
    linkedinUrl: org.linkedin_url || undefined,
    websiteUrl: org.website_url || undefined,
    location: [org.city, org.state, org.country].filter(Boolean).join(", ") || undefined,
    techStack: org.technologies?.length ? org.technologies : undefined,
    keywords: org.keywords?.length ? org.keywords : undefined,
    annualRevenue: org.annual_revenue_printed || undefined,
    totalFunding: org.total_funding_printed || undefined,
    latestFundingRound: org.latest_funding_round_type || undefined,
    phoneNumber: org.phone || undefined,
    apolloId: org.id || undefined,
    enrichedAt: new Date().toISOString(),
  };
}

function mapPerson(
  person: ApolloPerson,
  fallbackCompany: string,
  fallbackDomain?: string
): DecisionMaker {
  return {
    id: person.id || crypto.randomUUID(),
    firstName: person.first_name || "",
    lastName: person.last_name || "",
    fullName:
      person.name ||
      [person.first_name, person.last_name].filter(Boolean).join(" "),
    title: person.title || "",
    email: person.email || undefined,
    emailConfidence: person.email_confidence || undefined,
    linkedinUrl: person.linkedin_url || undefined,
    company: person.organization_name || fallbackCompany,
    companyDomain: person.organization?.primary_domain || fallbackDomain,
    seniority: person.seniority || undefined,
    departments: person.departments?.length ? person.departments : undefined,
    city: person.city || undefined,
    country: person.country || undefined,
    phoneNumbers: person.phone_numbers?.map((p) => p.raw_number) || undefined,
    apolloId: person.id || undefined,
    foundAt: new Date().toISOString(),
  };
}

// ---- Company ranking (prefer precision over position) ----

function rankOrg(
  org: ApolloOrg,
  queryName: string,
  queryDomain?: string,
  queryLocation?: string
): number {
  let score = 0;
  const name = (org.name ?? "").toLowerCase();
  const qName = queryName.toLowerCase();

  if (name === qName) {
    score += 50;
  } else if (name.includes(qName) || qName.includes(name)) {
    score += 30;
  } else {
    const qWords = qName.split(/\s+/).filter((w) => w.length > 2);
    const oWords = name.split(/\s+/);
    const hits = qWords.filter((w) =>
      oWords.some((ow) => ow.includes(w) || w.includes(ow))
    ).length;
    score += (hits / Math.max(qWords.length, 1)) * 20;
  }

  if (queryDomain) {
    const d = queryDomain.replace(/^www\./, "").toLowerCase();
    if (org.primary_domain?.toLowerCase().includes(d)) score += 25;
  }

  if (queryLocation) {
    const loc = queryLocation.toLowerCase();
    const orgLoc = [org.city, org.state, org.country].join(" ").toLowerCase();
    const ukTerms = ["uk", "united kingdom", "england", "scotland", "wales", "northern ireland"];
    if (
      ukTerms.some((t) => loc.includes(t)) &&
      ukTerms.some((t) => orgLoc.includes(t))
    ) {
      score += 10;
    }
  }

  return score;
}

// ---- Role-track title groups (precision over breadth) ----

const TRACK_TITLES: Record<string, string[]> = {
  pv: [
    "Head of Pharmacovigilance", "PV Manager", "Drug Safety Manager",
    "Pharmacovigilance Director", "Head of Drug Safety", "Drug Safety Director",
  ],
  regulatory: [
    "Head of Regulatory Affairs", "Regulatory Affairs Director",
    "Regulatory Affairs Manager", "VP Regulatory", "Director of Regulatory Affairs",
  ],
  qa: [
    "Head of Quality", "Quality Director", "QA Director",
    "Quality Assurance Manager", "Director of Quality Assurance", "VP Quality",
  ],
  clinical: [
    "Head of Clinical Operations", "Clinical Operations Director",
    "Clinical Research Manager", "Director of Clinical Research",
    "Clinical Trial Manager", "CRA Manager", "Site Management Lead",
  ],
  medinfo: [
    "Head of Medical Information", "Medical Affairs Director",
    "VP Medical Affairs", "Medical Information Manager",
  ],
};

const RECRUITER_TITLES = [
  "Talent Acquisition Manager", "Head of Talent Acquisition",
  "Senior Recruiter", "Head of Talent", "People Partner",
  "Recruiting Manager", "HR Manager", "Talent Partner",
];

function buildTitleList(roleContext?: RoleContext): string[] {
  if (!roleContext) return RECRUITER_TITLES;

  const track = (roleContext.roleTrack ?? "").toLowerCase();
  const family = (roleContext.roleFamily ?? "").toLowerCase();

  const key =
    track in TRACK_TITLES
      ? track
      : family.includes("pv") || family.includes("pharmacovigilance")
        ? "pv"
        : family.includes("regulatory")
          ? "regulatory"
          : family.includes("qa") || family.includes("quality")
            ? "qa"
            : family.includes("clinical")
              ? "clinical"
              : family.includes("medinfo") || family.includes("medical info")
                ? "medinfo"
                : null;

  const domainTitles = key ? (TRACK_TITLES[key] ?? []) : [];
  return [...domainTitles, ...RECRUITER_TITLES];
}

function buildDepartmentList(roleContext?: RoleContext): string[] {
  const base = ["human_resources"];
  if (!roleContext) return base;

  const track = (roleContext.roleTrack ?? "").toLowerCase();
  const family = (roleContext.roleFamily ?? "").toLowerCase();

  if (track === "clinical" || family.includes("clinical")) {
    base.push("medical_health", "program_management");
  } else if (track === "regulatory" || family.includes("regulatory")) {
    base.push("legal", "operations");
  } else if (track === "qa" || family.includes("quality")) {
    base.push("operations", "engineering");
  } else if (track === "pv" || family.includes("pharmacovigilance")) {
    base.push("medical_health");
  } else if (track === "medinfo" || family.includes("medinfo")) {
    base.push("medical_health");
  }

  return base;
}

// ---- Provider implementation ----

async function enrichByDomain(domain: string): Promise<EnrichResult<CompanyIntel>> {
  const key = `domain:${domain.toLowerCase()}`;
  const cached = companyCache.get(key);
  if (cached) return { status: "ok", data: cached };

  const raw = await apolloPost("organizations/enrich", { domain });
  if (raw.status !== "ok") return raw;
  if (!raw.data.organization) return { status: "not_found" };

  const intel = mapOrg(raw.data.organization as ApolloOrg, domain);
  companyCache.set(key, intel);
  return { status: "ok", data: intel };
}

async function enrichByName(
  name: string,
  location?: string
): Promise<EnrichResult<CompanyIntel>> {
  const key = `name:${name.toLowerCase()}:${location ?? ""}`;
  const cached = companyCache.get(key);
  if (cached) return { status: "ok", data: cached };

  const raw = await apolloPost("mixed_companies/search", {
    q_organization_name: name,
    organization_locations: location ? [location] : undefined,
    page: 1,
    per_page: 5, // fetch several to rank rather than trust position 0
  });
  if (raw.status !== "ok") return raw;

  const orgs = raw.data.organizations as ApolloOrg[] | undefined;
  if (!orgs?.length) return { status: "not_found" };

  const best = [...orgs].sort(
    (a, b) => rankOrg(b, name, undefined, location) - rankOrg(a, name, undefined, location)
  )[0];

  const intel = mapOrg(best);
  companyCache.set(key, intel);
  return { status: "ok", data: intel };
}

async function findDecisionMakers(
  companyName: string,
  companyDomain?: string,
  roleContext?: RoleContext
): Promise<EnrichResult<DecisionMaker[]>> {
  const key = `people:${companyName.toLowerCase()}:${companyDomain ?? ""}:${roleContext?.roleTrack ?? ""}`;
  const cached = peopleCache.get(key);
  if (cached) return { status: "ok", data: cached };

  const params: Record<string, unknown> = {
    q_organization_name: companyName,
    page: 1,
    per_page: 8,
    person_seniorities: ["director", "vp", "head", "manager", "senior"],
    person_titles: buildTitleList(roleContext),
    person_departments: buildDepartmentList(roleContext),
  };
  if (companyDomain) params.organization_domains = [companyDomain];

  const raw = await apolloPost("mixed_people/search", params);
  if (raw.status !== "ok") return raw;

  const people = raw.data.people as ApolloPerson[] | undefined;
  if (!people?.length) return { status: "not_found" };

  const dms = people.map((p) => mapPerson(p, companyName, companyDomain));
  peopleCache.set(key, dms);
  return { status: "ok", data: dms };
}

async function findEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<EnrichResult<EmailLookupResult>> {
  const key = `email:${firstName.toLowerCase()}:${lastName.toLowerCase()}:${domain.toLowerCase()}`;
  const cached = emailCache.get(key);
  if (cached) return { status: "ok", data: cached };

  const raw = await apolloPost("people/match", {
    first_name: firstName,
    last_name: lastName,
    organization_domain: domain,
    reveal_personal_emails: false,
  });
  if (raw.status !== "ok") return raw;
  if (!raw.data.person) return { status: "not_found" };

  const person = raw.data.person as ApolloPerson;
  const result: EmailLookupResult = {
    email: person.email || null,
    confidence: person.email_confidence || null,
  };
  if (result.email) emailCache.set(key, result);
  return { status: "ok", data: result };
}

async function checkHealth(): Promise<ProviderHealth> {
  const cached = healthCache.get("health");
  if (cached) return cached;

  const apiKey = await getApolloKey();
  if (!apiKey) {
    const result: ProviderHealth = { available: false, error: "Apollo API key not configured" };
    healthCache.set("health", result);
    return result;
  }

  try {
    const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ page: 1, per_page: 1 }),
      signal: AbortSignal.timeout(8_000),
    });

    let health: ProviderHealth;

    if (response.status === 403) {
      const body = await response.json().catch(() => ({})) as { error_code?: string };
      health = body.error_code === "API_INACCESSIBLE"
        ? {
            available: true,
            tier: "free",
            restrictions: ["mixed_people/search restricted on free plan"],
            error: "Free plan: some endpoints restricted",
          }
        : { available: false, error: "Invalid or expired API key" };
    } else if (response.status === 401) {
      health = { available: false, error: "Invalid or expired API key" };
    } else {
      health = {
        available: response.ok,
        tier: response.ok ? "paid" : undefined,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    }

    healthCache.set("health", health, health.available ? HEALTH_TTL : HEALTH_ERR_TTL);
    return health;
  } catch (err) {
    const health: ProviderHealth = {
      available: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
    healthCache.set("health", health, HEALTH_ERR_TTL);
    return health;
  }
}

// ---- Public provider object ----

export const apolloProvider = {
  enrichByDomain,
  enrichByName,
  findDecisionMakers,
  findEmail,
  checkHealth,
  getBudgetStats: () => budget.stats(),
};

// ---- Legacy null-returning API (for apollo-client.ts backward compat) ----

export async function legacyEnrichByDomain(domain: string): Promise<CompanyIntel | null> {
  const r = await enrichByDomain(domain);
  return r.status === "ok" ? r.data : null;
}

export async function legacyEnrichByName(
  name: string,
  location?: string
): Promise<CompanyIntel | null> {
  const r = await enrichByName(name, location);
  return r.status === "ok" ? r.data : null;
}

export async function legacyFindDecisionMakers(
  companyName: string,
  companyDomain?: string,
  roleContext?: RoleContext
): Promise<DecisionMaker[]> {
  const r = await findDecisionMakers(companyName, companyDomain, roleContext);
  return r.status === "ok" ? r.data : [];
}

export async function legacyFindEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<{ email: string | null; confidence: string | null }> {
  const r = await findEmail(firstName, lastName, domain);
  return r.status === "ok" ? r.data : { email: null, confidence: null };
}

export async function legacyCheckHealth(): Promise<{ available: boolean; error?: string }> {
  const h = await checkHealth();
  return { available: h.available, error: h.error };
}
