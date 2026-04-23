import { readObject, ConfigFiles } from "@/lib/storage";
import { AppConfig } from "@/types";

export function getDefaultAppConfig(): AppConfig {
  const serpApiKey = "f66ac90eb04f2a20d3a12d8996e95ad682e9cb8665cd5a089dc506acab21635f";
  const adzunaAppId = "2a471528";
  const adzunaAppKey = "2781950e31ec2cffd8f1fea99cea134b";
  const reedApiKey = "2bcc2781-5ae0-487f-bbe7-9a25813d17d2";
  const joobleApiKey = "60ef3b3b-2241-4d01-be5a-ee1aefae2d26";
  const findworkApiKey = "f5bc07ec98c7dbc7d43cab9802065eb24394175f";
  const themuseApiKey = "125d1e9c523e6ab57d15d91281d649d3a8449ebb67f25b6da075c89bb82ae30e";
  const apolloApiKey = "Jya5V62Ke7mu_8vEuxxfxQ";

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
        appId: stored.jobSources?.adzuna?.appId || defaults.jobSources.adzuna.appId,
        appKey: stored.jobSources?.adzuna?.appKey || defaults.jobSources.adzuna.appKey,
      },
      reed: {
        ...defaults.jobSources.reed,
        ...stored.jobSources?.reed,
        apiKey: stored.jobSources?.reed?.apiKey || defaults.jobSources.reed.apiKey,
      },
      jooble: {
        ...defaults.jobSources.jooble,
        ...stored.jobSources?.jooble,
        apiKey: stored.jobSources?.jooble?.apiKey || defaults.jobSources.jooble.apiKey,
      },
      serpApi: {
        ...defaults.jobSources.serpApi,
        ...stored.jobSources?.serpApi,
        apiKey: stored.jobSources?.serpApi?.apiKey || defaults.jobSources.serpApi.apiKey,
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
        apiKey: stored.jobSources?.findwork?.apiKey || defaults.jobSources.findwork.apiKey,
      },
      themuse: {
        ...defaults.jobSources.themuse,
        ...stored.jobSources?.themuse,
        apiKey: stored.jobSources?.themuse?.apiKey || defaults.jobSources.themuse.apiKey,
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
