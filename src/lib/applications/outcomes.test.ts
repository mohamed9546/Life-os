import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  getApplicationLogs: vi.fn(),
  getCvLibrary: vi.fn(),
}));

vi.mock("@/lib/jobs/storage", () => ({
  getRankedJobs: vi.fn(),
  getEnrichedJobs: vi.fn(),
  getInboxJobs: vi.fn(),
  getRejectedJobs: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  ConfigFiles: {
    APPLICATION_OUTCOMES: "application-outcomes",
  },
  readObject: vi.fn(),
  writeObject: vi.fn(),
}));

import { getApplicationLogs, getCvLibrary } from "./storage";
import { getEnrichedJobs, getInboxJobs, getRankedJobs, getRejectedJobs } from "@/lib/jobs/storage";
import {
  buildApplicationOutcomeSnapshot,
  getLatestApplicationOutcomeSnapshot,
  saveApplicationOutcomeSnapshot,
  summariseApplicationOutcomes,
} from "./outcomes";
import { readObject, writeObject } from "@/lib/storage";

const NOW = new Date("2026-05-01T12:00:00.000Z");

function iso(daysAgo: number) {
  return new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function createLog(input: Partial<any>) {
  return {
    id: "attempt-default",
    jobId: null,
    dedupeKey: "dedupe-default",
    source: "adzuna",
    company: "Acme",
    title: "Clinical Trial Assistant",
    applyUrl: "https://example.com/apply",
    selectedCvId: undefined,
    selectedCvPath: undefined,
    tailoredCvPath: null,
    status: "applied",
    blocker: undefined,
    blockerDetail: undefined,
    fitBand: "high",
    fitScore: 80,
    browserEvidence: undefined,
    gmailDraftId: undefined,
    attemptedAt: iso(5),
    createdAt: iso(5),
    updatedAt: iso(5),
    ...input,
  };
}

function createJob(input: Partial<any>) {
  return {
    id: "job-default",
    raw: {
      source: "adzuna",
      company: "Acme",
      title: "Clinical Trial Assistant",
      location: "Glasgow",
      salaryText: "35000",
      link: "https://example.com/job",
      fetchedAt: iso(6),
      remoteType: "hybrid",
    },
    parsed: {
      data: {
        title: "Clinical Trial Assistant",
        company: "Acme",
        location: "Glasgow",
        salaryText: "35000",
        employmentType: "permanent",
        seniority: "entry",
        remoteType: "hybrid",
        roleFamily: "trial-support",
        roleTrack: "clinical",
        mustHaves: [],
        niceToHaves: [],
        redFlags: [],
        keywords: [],
        summary: "CTA support role",
        confidence: 0.9,
      },
      meta: {
        model: "n/a",
        promptType: "n/a",
        timestamp: iso(6),
        confidence: 0.9,
        durationMs: 0,
        inputBytes: 0,
        outputBytes: 0,
        fallbackUsed: false,
        fallbackAttempted: false,
        attemptCount: 1,
        effectiveTimeoutMs: 0,
        jsonExtractionFallback: false,
      },
    },
    fit: {
      data: {
        fitScore: 82,
        redFlagScore: 10,
        priorityBand: "high",
        whyMatched: [],
        whyNot: [],
        strategicValue: "high",
        likelyInterviewability: "good",
        actionRecommendation: "apply now",
        visaRisk: "green",
        confidence: 0.9,
      },
      meta: {
        model: "n/a",
        promptType: "n/a",
        timestamp: iso(6),
        confidence: 0.9,
        durationMs: 0,
        inputBytes: 0,
        outputBytes: 0,
        fallbackUsed: false,
        fallbackAttempted: false,
        attemptCount: 1,
        effectiveTimeoutMs: 0,
        jsonExtractionFallback: false,
      },
    },
    status: "tracked",
    dedupeKey: "dedupe-default",
    decisionMakers: [],
    outreachStrategy: null,
    companyIntel: null,
    followUpDate: null,
    followUpNote: null,
    stageChangedAt: iso(4),
    createdAt: iso(6),
    updatedAt: iso(4),
    ...input,
  };
}

function createOutcomeRecord(input: Partial<any>) {
  return {
    recordId: "record-default",
    recordKind: "application_attempt",
    applicationAttemptId: "attempt-default",
    jobId: "job-default",
    dedupeKey: "dedupe-default",
    source: "adzuna",
    company: "Acme",
    roleTitle: "Clinical Trial Assistant",
    roleTrack: "clinical",
    cvVersion: "CTA Master",
    pipelineStatus: null,
    latestAttemptStatus: "drafted",
    currentStatus: "drafted",
    applicationDate: iso(5),
    latestStatusDate: iso(5),
    responseReceived: false,
    responseDate: null,
    interviewReceived: false,
    rejectionReceived: false,
    offerReceived: false,
    ghosted: false,
    daysSinceApplication: 5,
    daysToResponse: null,
    followUpDue: false,
    followUpStage: null,
    recruiterName: null,
    agencyName: null,
    location: "Glasgow",
    remoteType: "hybrid",
    salaryText: "35000",
    fitScore: 80,
    matchScore: null,
    notes: null,
    ...input,
  };
}

describe("application outcome ETL", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    vi.mocked(getRankedJobs).mockResolvedValue([] as any);
    vi.mocked(getEnrichedJobs).mockResolvedValue([] as any);
    vi.mocked(getInboxJobs).mockResolvedValue([] as any);
    vi.mocked(getRejectedJobs).mockResolvedValue([] as any);
    vi.mocked(getCvLibrary).mockResolvedValue([
      {
        id: "cv-clinical",
        label: "CTA Master",
        path: "C:/cvs/cta-master.docx",
        roleTracks: ["clinical"],
        keywords: [],
        active: true,
        createdAt: iso(100),
        updatedAt: iso(100),
      },
      {
        id: "cv-qa",
        label: "QA Focus",
        path: "C:/cvs/qa-focus.docx",
        roleTracks: ["qa"],
        keywords: [],
        active: true,
        createdAt: iso(100),
        updatedAt: iso(100),
      },
    ] as any);
    vi.mocked(readObject).mockResolvedValue(null as any);
    vi.mocked(writeObject).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves attempt-level grain, uses dedupeKey only for joins, and keeps inputs immutable", async () => {
    const logs = [
      createLog({ id: "attempt-1", dedupeKey: "acme-role", jobId: "job-acme", selectedCvId: "cv-clinical", attemptedAt: iso(30), updatedAt: iso(30) }),
      createLog({ id: "attempt-2", dedupeKey: "acme-role", jobId: "missing-job-id", selectedCvId: "cv-qa", attemptedAt: iso(20), updatedAt: iso(20) }),
      createLog({ id: "attempt-3", dedupeKey: "beta-offer", jobId: "job-beta", selectedCvId: "missing-cv", attemptedAt: iso(12), updatedAt: iso(12), source: "reed", company: "Beta" }),
      createLog({ id: "attempt-4", dedupeKey: "first-followup", jobId: "job-first", attemptedAt: iso(8), updatedAt: iso(8), status: "paused", source: "totaljobs", company: "Gamma" }),
      createLog({ id: "attempt-5", dedupeKey: "second-followup", jobId: "job-second", attemptedAt: iso(18), updatedAt: iso(18), status: "paused", source: "linkedin", company: "Delta" }),
      createLog({ id: "attempt-6", dedupeKey: "ghosted-role", jobId: "job-ghosted", attemptedAt: iso(21), updatedAt: iso(21), source: "jobsac", company: "Epsilon" }),
      createLog({ id: "attempt-7", dedupeKey: "rejected-role", jobId: "job-rejected", attemptedAt: iso(10), updatedAt: iso(10), source: "nhsjobs", company: "Zeta" }),
    ];

    const jobs = [
      createJob({
        id: "job-acme",
        dedupeKey: "acme-role",
        status: "interview",
        stageChangedAt: iso(9),
        updatedAt: iso(9),
        raw: { source: "adzuna", company: "Acme", title: "Clinical Trial Assistant", location: "Glasgow", salaryText: "35000", link: "https://example.com/acme", fetchedAt: iso(31), remoteType: "hybrid" },
        decisionMakers: [{ id: "dm-1", firstName: "Alice", lastName: "Recruiter", fullName: "Alice Recruiter", title: "Talent Partner", company: "Acme", foundAt: iso(40) }],
      }),
      createJob({
        id: "job-acme-pipeline",
        dedupeKey: "acme-pipeline",
        status: "tracked",
        stageChangedAt: iso(3),
        updatedAt: iso(3),
        raw: { source: "adzuna", company: "Acme", title: "Clinical Trial Coordinator", location: "Glasgow", salaryText: "36000", link: "https://example.com/acme-2", fetchedAt: iso(4), remoteType: "hybrid" },
        decisionMakers: [{ id: "dm-2", firstName: "Alice", lastName: "Recruiter", fullName: "Alice Recruiter", title: "Talent Partner", company: "Acme", foundAt: iso(40) }],
      }),
      createJob({
        id: "job-beta",
        dedupeKey: "beta-offer",
        status: "offer",
        stageChangedAt: iso(4),
        updatedAt: iso(4),
        raw: { source: "reed", company: "Beta", title: "QA Associate", location: "London", salaryText: "40000", link: "https://example.com/beta", fetchedAt: iso(13), remoteType: "hybrid" },
        parsed: { ...createJob({}).parsed, data: { ...createJob({}).parsed.data, title: "QA Associate", company: "Beta", roleTrack: "qa", location: "London", remoteType: "hybrid" } },
      }),
      createJob({ id: "job-first", dedupeKey: "first-followup", status: "tracked", stageChangedAt: iso(7), updatedAt: iso(7), raw: { source: "totaljobs", company: "Gamma", title: "Regulatory Coordinator", location: "Remote", salaryText: "33000", link: "https://example.com/first", fetchedAt: iso(9), remoteType: "remote" } }),
      createJob({ id: "job-second", dedupeKey: "second-followup", status: "tracked", stageChangedAt: iso(17), updatedAt: iso(17), raw: { source: "linkedin", company: "Delta", title: "Clinical Assistant", location: "Remote", salaryText: "32000", link: "https://example.com/second", fetchedAt: iso(20), remoteType: "remote" } }),
      createJob({ id: "job-ghosted", dedupeKey: "ghosted-role", status: "tracked", stageChangedAt: iso(20), updatedAt: iso(20), raw: { source: "jobsac", company: "Epsilon", title: "Research Assistant", location: "Remote", salaryText: "31000", link: "https://example.com/ghosted", fetchedAt: iso(22), remoteType: "remote" } }),
      createJob({ id: "job-rejected", dedupeKey: "rejected-role", status: "rejected", stageChangedAt: iso(2), updatedAt: iso(2), raw: { source: "nhsjobs", company: "Zeta", title: "Clinical Trial Assistant", location: "Glasgow", salaryText: "34000", link: "https://example.com/rejected", fetchedAt: iso(12), remoteType: "onsite" } }),
      createJob({ id: "job-shortlisted", dedupeKey: "shortlisted-only", status: "shortlisted", stageChangedAt: iso(1), updatedAt: iso(1), raw: { source: "guardianjobs", company: "Eta", title: "Clinical Project Assistant", location: "Remote", salaryText: "37000", link: "https://example.com/shortlisted", fetchedAt: iso(2), remoteType: "remote" } }),
    ];

    const logsClone = structuredClone(logs);
    const jobsClone = structuredClone(jobs);

    vi.mocked(getApplicationLogs).mockResolvedValue(logs as any);
    vi.mocked(getEnrichedJobs).mockResolvedValue(jobs as any);

    const snapshot = await buildApplicationOutcomeSnapshot("user-1");

    expect(logs).toEqual(logsClone);
    expect(jobs).toEqual(jobsClone);

    const acmeAttempts = snapshot.records.filter((record) => record.dedupeKey === "acme-role");
    expect(acmeAttempts).toHaveLength(2);
    expect(acmeAttempts.map((record) => record.recordId).sort()).toEqual(["attempt-1", "attempt-2"]);
    expect(acmeAttempts.every((record) => record.recordKind === "application_attempt")).toBe(true);

    const pipelineOnly = snapshot.records.find((record) => record.recordId === "acme-pipeline");
    expect(pipelineOnly?.recordKind).toBe("pipeline_job");
    expect(pipelineOnly?.applicationAttemptId).toBeNull();

    const acmeCompany = snapshot.summaries.byCompany.find((entry) => entry.key === "Acme");
    expect(acmeCompany).toMatchObject({
      totalRecords: 3,
      attemptRecords: 2,
      pipelineOnlyRecords: 1,
      appliedAttempts: 2,
      responded: 2,
      responseRate: 100,
    });

    const byCvVersionKeys = snapshot.summaries.byCvVersion.map((entry) => entry.key);
    expect(byCvVersionKeys).toEqual(expect.arrayContaining(["CTA Master", "QA Focus", "unknown"]));
    const unknownCv = snapshot.summaries.byCvVersion.find((entry) => entry.key === "unknown");
    expect(unknownCv?.pipelineOnlyRecords).toBe(0);

    const interviewRow = snapshot.records.find((record) => record.recordId === "attempt-1");
    const offerRow = snapshot.records.find((record) => record.recordId === "attempt-3");
    const rejectedRow = snapshot.records.find((record) => record.recordId === "attempt-7");
    expect(interviewRow?.responseReceived).toBe(true);
    expect(offerRow?.responseReceived).toBe(true);
    expect(rejectedRow?.responseReceived).toBe(true);

    const firstFollowUp = snapshot.records.find((record) => record.recordId === "attempt-4");
    const secondFollowUp = snapshot.records.find((record) => record.recordId === "attempt-5");
    const ghosted = snapshot.records.find((record) => record.recordId === "attempt-6");
    expect(firstFollowUp).toMatchObject({ followUpDue: true, followUpStage: "first", ghosted: false });
    expect(secondFollowUp).toMatchObject({ followUpDue: true, followUpStage: "second", ghosted: false });
    expect(ghosted).toMatchObject({ followUpDue: true, followUpStage: "second", ghosted: true });

    const recruiterSummary = snapshot.summaries.byRecruiter.find((entry) => entry.key === "Alice Recruiter");
    expect(recruiterSummary).toMatchObject({
      totalRecords: 3,
      attemptRecords: 2,
      pipelineOnlyRecords: 1,
      appliedAttempts: 2,
      responseRate: 100,
    });
  });

  it("stores and loads the latest snapshot per user", async () => {
    const snapshot = {
      userId: "user-1",
      generatedAt: NOW.toISOString(),
      etlVersion: 1,
      thresholds: { firstFollowUpDays: 8, secondFollowUpDays: 18, ghostedDays: 21 },
      records: [],
      summaries: {
        overall: {
          key: "overall",
          label: "Overall",
          totalRecords: 0,
          attemptRecords: 0,
          pipelineOnlyRecords: 0,
          usefulRoles: 0,
          appliedAttempts: 0,
          responded: 0,
          interviews: 0,
          rejections: 0,
          offers: 0,
          ghosted: 0,
          followUpDue: 0,
          responseRate: null,
          interviewRate: null,
          offerRate: null,
        },
        byTrack: [],
        bySource: [],
        byCvVersion: [],
        byCompany: [],
        byRecruiter: [],
        stageLeakage: [],
        followUpDue: [],
        ghosted: [],
      },
    } as any;

    vi.mocked(readObject).mockResolvedValueOnce({ version: 1, snapshotsByUserId: { "user-2": snapshot } } as any);

    await saveApplicationOutcomeSnapshot(snapshot);
    expect(writeObject).toHaveBeenCalledWith("application-outcomes", {
      version: 1,
      snapshotsByUserId: {
        "user-2": snapshot,
        "user-1": snapshot,
      },
    });

    vi.mocked(readObject).mockResolvedValueOnce({ version: 1, snapshotsByUserId: { "user-1": snapshot } } as any);
    await expect(getLatestApplicationOutcomeSnapshot("user-1")).resolves.toEqual(snapshot);
  });

  it("counts useful roles only for meaningful progression across summaries", () => {
    const records = [
      createOutcomeRecord({
        recordId: "attempt-inbox",
        source: "adzuna",
        company: "Acme",
        roleTrack: "clinical",
        currentStatus: "inbox",
        latestAttemptStatus: "drafted",
      }),
      createOutcomeRecord({
        recordId: "attempt-drafted",
        source: "adzuna",
        company: "Acme",
        roleTrack: "clinical",
        currentStatus: "drafted",
        latestAttemptStatus: "drafted",
      }),
      createOutcomeRecord({
        recordId: "attempt-planned",
        source: "adzuna",
        company: "Acme",
        roleTrack: "clinical",
        currentStatus: "planned",
        latestAttemptStatus: "planned",
      }),
      createOutcomeRecord({
        recordId: "attempt-applied",
        source: "adzuna",
        company: "Acme",
        roleTrack: "clinical",
        currentStatus: "applied",
        latestAttemptStatus: "applied",
      }),
      createOutcomeRecord({
        recordId: "attempt-interview",
        source: "reed",
        company: "Beta",
        roleTrack: "qa",
        cvVersion: "QA Focus",
        currentStatus: "interview",
        latestAttemptStatus: "applied",
        responseReceived: true,
        interviewReceived: true,
      }),
      createOutcomeRecord({
        recordId: "attempt-offer",
        source: "reed",
        company: "Beta",
        roleTrack: "qa",
        cvVersion: "QA Focus",
        currentStatus: "offer",
        latestAttemptStatus: "applied",
        responseReceived: true,
        offerReceived: true,
      }),
      createOutcomeRecord({
        recordId: "attempt-rejected",
        source: "reed",
        company: "Beta",
        roleTrack: "qa",
        cvVersion: "QA Focus",
        currentStatus: "rejected",
        latestAttemptStatus: "applied",
        responseReceived: true,
        rejectionReceived: true,
      }),
      createOutcomeRecord({
        recordId: "pipeline-shortlisted",
        recordKind: "pipeline_job",
        applicationAttemptId: null,
        source: "adzuna",
        company: "Acme",
        roleTrack: "clinical",
        cvVersion: "unknown",
        currentStatus: "shortlisted",
        latestAttemptStatus: null,
        applicationDate: null,
      }),
      createOutcomeRecord({
        recordId: "pipeline-tracked",
        recordKind: "pipeline_job",
        applicationAttemptId: null,
        source: "linkedin",
        company: "Gamma",
        roleTrack: "regulatory",
        cvVersion: "unknown",
        currentStatus: "tracked",
        latestAttemptStatus: null,
        applicationDate: null,
      }),
      createOutcomeRecord({
        recordId: "pipeline-inbox",
        recordKind: "pipeline_job",
        applicationAttemptId: null,
        source: "adzuna",
        company: "Acme",
        roleTrack: "clinical",
        cvVersion: "unknown",
        currentStatus: "inbox",
        latestAttemptStatus: null,
        applicationDate: null,
      }),
    ];

    const summaries = summariseApplicationOutcomes(records as any);

    expect(summaries.overall.usefulRoles).toBe(6);

    const adzunaSource = summaries.bySource.find((entry) => entry.key === "adzuna");
    expect(adzunaSource?.usefulRoles).toBe(2);

    const clinicalTrack = summaries.byTrack.find((entry) => entry.key === "clinical");
    expect(clinicalTrack?.usefulRoles).toBe(2);

    const acmeCompany = summaries.byCompany.find((entry) => entry.key === "Acme");
    expect(acmeCompany?.usefulRoles).toBe(2);

    const qaCv = summaries.byCvVersion.find((entry) => entry.key === "QA Focus");
    expect(qaCv?.usefulRoles).toBe(3);
  });
});
