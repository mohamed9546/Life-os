import type { CompanyIntel, DecisionMaker } from "@/types";

// ---- 6-state result type ----

export type EnrichResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "not_configured" }
  | { status: "plan_restricted"; endpoint: string }
  | { status: "auth_failed" }
  | { status: "timeout"; endpoint: string }
  | { status: "network_error"; error: string };

export function isOk<T>(r: EnrichResult<T>): r is { status: "ok"; data: T } {
  return r.status === "ok";
}

export function unwrapOrNull<T>(r: EnrichResult<T>): T | null {
  return r.status === "ok" ? r.data : null;
}

// ---- Domain types ----

export interface EmailLookupResult {
  email: string | null;
  confidence: string | null;
}

export interface ProviderHealth {
  available: boolean;
  tier?: "free" | "paid";
  restrictions?: string[];
  error?: string;
}

export interface RoleContext {
  department?: string;
  roleFamily?: string;
  roleTrack?: string;
  jobTitle?: string;
}

// ---- Provider interfaces ----

export interface CompanyEnrichmentProvider {
  enrichByDomain(domain: string): Promise<EnrichResult<CompanyIntel>>;
  enrichByName(name: string, location?: string): Promise<EnrichResult<CompanyIntel>>;
}

export interface PeopleSearchProvider {
  findDecisionMakers(
    companyName: string,
    companyDomain?: string,
    roleContext?: RoleContext
  ): Promise<EnrichResult<DecisionMaker[]>>;
}

export interface EmailFinderProvider {
  findEmail(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<EnrichResult<EmailLookupResult>>;
}

export interface HealthCheckProvider {
  checkHealth(): Promise<ProviderHealth>;
}

export type EnrichmentProvider =
  CompanyEnrichmentProvider &
  PeopleSearchProvider &
  EmailFinderProvider &
  HealthCheckProvider;
