// Enrichment module public API.
// Company intelligence, decision maker discovery, and outreach generation.
// Apollo is an optional power-up — all callers must work when it is unavailable.

// ---- Apollo provider (structured API) ----
export { apolloProvider } from "./providers/apollo";
export type { EnrichResult, ProviderHealth, RoleContext, EmailLookupResult } from "./providers/types";
export { isOk, unwrapOrNull } from "./providers/types";

// ---- Legacy null-returning API (backward compat) ----
export {
  enrichCompanyByDomain,
  enrichCompanyByName,
  findDecisionMakers,
  findEmail,
  checkApolloHealth,
} from "./apollo-client";

// ---- Contact strategy ----
export { buildContactStrategy } from "./contact-strategy";
export type { ContactStrategyResult, ContactStrategyOptions } from "./contact-strategy";

// ---- Outreach ----
export { generateOutreachStrategy } from "./outreach-ai";
