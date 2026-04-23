import { readObject, ConfigFiles } from "@/lib/storage";
import { AppConfig } from "@/types";

export function getDefaultAppConfig(): AppConfig {
  const serpApiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY || "";
  const adzunaAppId = process.env.ADZUNA_APP_ID || "";
  const adzunaAppKey = process.env.ADZUNA_APP_KEY || "";
  const reedApiKey = process.env.REED_API_KEY || "";
  const joobleApiKey = process.env.JOOBLE_API_KEY || "";
  const findworkApiKey = process.env.FINDWORK_API_KEY || "";
  const themuseApiKey = process.env.THEMUSE_API_KEY || "";
  const apolloApiKey = process.env.APOLLO_API_KEY || "";

  return {
    jobSources: {
      adzuna: { enabled: true, appId: adzunaAppId, appKey: adzunaAppKey, country: "gb" },
      reed: { enabled: true, apiKey: reedApiKey },
      jooble: { enabled: true, apiKey: joobleApiKey },
      serpApi: {
        enabled: true,
        apiKey: serpApiKey,
        gl: "uk",
        hl: "en",
        googleDomain: "google.co.uk",
      },
      greenhouse: { enabled: true, companies: [] },
      lever: { enabled: true, companies: [] },
      remotive: { enabled: true },
      arbeitnow: { enabled: true },
      findwork: { enabled: true, apiKey: findworkApiKey },
      themuse: { enabled: true, apiKey: themuseApiKey },
      careerjet: { enabled: true, affid: "" },
      himalayas: { enabled: true },
      brightnetwork: { enabled: true },
      indeed: { enabled: true },
      weworkremotely: { enabled: true },
      guardianjobs: { enabled: true },
      linkedin: { enabled: true },
      rapidApiLinkedin: { enabled: true, apiKey: "" },
    },
    enrichment: {
      apollo: { enabled: true, apiKey: apolloApiKey },
      autoEnrichCompany: true,
      autoFindDecisionMakers: true,
      autoFindEmails: true,
      autoGenerateOutreach: true,
      minFitScoreForPeopleSearch: 45,
      minFitScoreForOutreach: 55,
    },
    worker: {
      tasks: [],
    },
  };
}

export async function getAppConfig(): Promise<AppConfig> {
  const stored = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
  if (!stored) {
    return getDefaultAppConfig();
  }

  const defaults = getDefaultAppConfig();

  return {
    jobSources: {
      ...defaults.jobSources,
      ...stored.jobSources,
      adzuna: {
        ...defaults.jobSources.adzuna,
        ...stored.jobSources?.adzuna,
      },
      reed: {
        ...defaults.jobSources.reed,
        ...stored.jobSources?.reed,
      },
      jooble: {
        ...defaults.jobSources.jooble,
        ...stored.jobSources?.jooble,
      },
      serpApi: {
        ...defaults.jobSources.serpApi,
        ...stored.jobSources?.serpApi,
      },
      greenhouse: {
        ...defaults.jobSources.greenhouse,
        ...stored.jobSources?.greenhouse,
      },
      lever: {
        ...defaults.jobSources.lever,
        ...stored.jobSources?.lever,
      },
      remotive: {
        ...defaults.jobSources.remotive,
        ...stored.jobSources?.remotive,
      },
      arbeitnow: {
        ...defaults.jobSources.arbeitnow,
        ...stored.jobSources?.arbeitnow,
      },
      findwork: {
        ...defaults.jobSources.findwork,
        ...stored.jobSources?.findwork,
      },
      themuse: {
        ...defaults.jobSources.themuse,
        ...stored.jobSources?.themuse,
      },
      careerjet: {
        ...defaults.jobSources.careerjet,
        ...stored.jobSources?.careerjet,
      },
      himalayas: {
        ...defaults.jobSources.himalayas,
        ...stored.jobSources?.himalayas,
      },
      brightnetwork: {
        ...defaults.jobSources.brightnetwork,
        ...stored.jobSources?.brightnetwork,
      },
      indeed: {
        ...defaults.jobSources.indeed,
        ...stored.jobSources?.indeed,
      },
      linkedin: {
        ...defaults.jobSources.linkedin,
        ...stored.jobSources?.linkedin,
      },
      rapidApiLinkedin: {
        ...defaults.jobSources.rapidApiLinkedin,
        ...stored.jobSources?.rapidApiLinkedin,
      },
      weworkremotely: {
        ...defaults.jobSources.weworkremotely,
        ...stored.jobSources?.weworkremotely,
      },
      guardianjobs: {
        ...defaults.jobSources.guardianjobs,
        ...stored.jobSources?.guardianjobs,
      },
    },
    enrichment: {
      ...defaults.enrichment,
      ...stored.enrichment,
      apollo: {
        ...defaults.enrichment.apollo,
        ...stored.enrichment?.apollo,
      },
    },
    worker: stored.worker || defaults.worker,
  };
}
