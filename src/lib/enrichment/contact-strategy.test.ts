import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/apollo", () => ({
  apolloProvider: {
    enrichByName: vi.fn(),
    findDecisionMakers: vi.fn(),
    findEmail: vi.fn(),
  },
}));

vi.mock("./outreach-ai", () => ({
  generateOutreachStrategy: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/config/app-config", () => ({
  getAppConfig: vi.fn(),
}));

import { buildContactStrategy } from "./contact-strategy";
import { apolloProvider } from "./providers/apollo";
import { getAppConfig } from "@/lib/config/app-config";

const rawJob = {
  source: "adzuna",
  sourceJobId: "job-1",
  company: "Acme",
  title: "Clinical Trial Assistant",
  location: "Glasgow",
  link: "https://example.com/job",
  fetchedAt: new Date().toISOString(),
} as any;

const parsedJob = {
  title: "Clinical Trial Assistant",
  company: "Acme",
  location: "Glasgow",
  salaryText: null,
  employmentType: "permanent",
  seniority: "entry",
  remoteType: "hybrid",
  roleFamily: "clinical operations",
  roleTrack: "clinical",
  mustHaves: [],
  niceToHaves: [],
  redFlags: [],
  keywords: [],
  summary: "support role",
  confidence: 0.9,
} as any;

const fit = {
  fitScore: 75,
  redFlagScore: 5,
  priorityBand: "high",
  whyMatched: [],
  whyNot: [],
  strategicValue: "high",
  likelyInterviewability: "good",
  actionRecommendation: "apply now",
  visaRisk: "green",
  confidence: 0.9,
} as any;

describe("contact strategy guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppConfig).mockResolvedValue({
      enrichment: {
        apollo: { enabled: true, apiKey: "fake-apollo" },
        autoEnrichCompany: true,
        autoFindDecisionMakers: true,
        autoFindEmails: true,
        autoGenerateOutreach: false,
        minFitScoreForPeopleSearch: 45,
        minFitScoreForOutreach: 55,
      },
    } as any);
  });

  it("skips repeated Apollo company and people calls in the same run after plan restriction", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(apolloProvider.enrichByName).mockResolvedValue({
      status: "plan_restricted",
      endpoint: "mixed_companies/search",
    } as any);

    const result = await buildContactStrategy(rawJob, parsedJob, fit);

    expect(apolloProvider.enrichByName).toHaveBeenCalledTimes(1);
    expect(apolloProvider.findDecisionMakers).not.toHaveBeenCalled();
    expect(apolloProvider.findEmail).not.toHaveBeenCalled();
    expect(result.companyIntel).toBeNull();
    expect(result.decisionMakers.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith("[apollo] enrichment skipped: plan restricted");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns safe fallback decision makers when Apollo people search is plan restricted", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(apolloProvider.enrichByName).mockResolvedValue({
      status: "ok",
      data: { name: "Acme", domain: "acme.test", enrichedAt: new Date().toISOString() },
    } as any);
    vi.mocked(apolloProvider.findDecisionMakers).mockResolvedValue({
      status: "plan_restricted",
      endpoint: "mixed_people/search",
    } as any);

    const result = await buildContactStrategy(rawJob, parsedJob, fit);

    expect(apolloProvider.enrichByName).toHaveBeenCalledTimes(1);
    expect(apolloProvider.findDecisionMakers).toHaveBeenCalledTimes(1);
    expect(apolloProvider.findEmail).not.toHaveBeenCalled();
    expect(result.companyIntel?.domain).toBe("acme.test");
    expect(result.decisionMakers.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith("[apollo] enrichment skipped: plan restricted");
  });
});
