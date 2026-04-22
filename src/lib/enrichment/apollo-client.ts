// Backward-compatibility shim — new code should use apolloProvider from providers/apollo.ts.
export {
  legacyEnrichByDomain as enrichCompanyByDomain,
  legacyEnrichByName as enrichCompanyByName,
  legacyFindDecisionMakers as findDecisionMakers,
  legacyFindEmail as findEmail,
  legacyCheckHealth as checkApolloHealth,
} from "./providers/apollo";
