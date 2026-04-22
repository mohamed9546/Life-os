import { readObject, ConfigFiles } from "@/lib/storage";
import { AppConfig } from "@/types";

export function getDefaultAppConfig(): AppConfig {
  const serpApiKey =
    process.env.SERPAPI_API_KEY ||
    process.env.SERPAPI_KEY ||
    "";

  return {
    jobSources: {
      adzuna: { enabled: true, appId: "", appKey: "", country: "gb" },
      reed: { enabled: true, apiKey: "" },
      jooble: { enabled: false, apiKey: "" },
      serpApi: {
        enabled: false,
        apiKey: serpApiKey,
        gl: "uk",
        hl: "en",
        googleDomain: "google.co.uk",
      },
      greenhouse: { enabled: true, companies: [] },
      lever: { enabled: true, companies: [] },
      remotive: { enabled: false },
      arbeitnow: { enabled: false },
      findwork: { enabled: false, apiKey: "" },
      themuse: { enabled: false, apiKey: "" },
      careerjet: { enabled: false, affid: "" },
      himalayas: { enabled: false },
      brightnetwork: { enabled: false },
      indeed: { enabled: false },
      weworkremotely: { enabled: false },
      guardianjobs: { enabled: false },
      linkedin: { enabled: false },
      rapidApiLinkedin: { enabled: false, apiKey: "" },
    },
    enrichment: {
      apollo: { enabled: false, apiKey: "" },
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
