import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CvPerformanceSection } from "./application-outcomes-panel";

describe("application outcomes panel CV section", () => {
  it("shows counts and small-sample warnings", () => {
    const html = renderToStaticMarkup(
      createElement(CvPerformanceSection, {
        snapshot: {
          userId: "user-1",
          generatedAt: new Date().toISOString(),
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
            cvPerformance: {
              byVersion: [
                {
                  cvVersion: "CTA Master",
                  scope: "global",
                  scopeValue: "global",
                  scopeLabel: "All applications",
                  attemptCount: 2,
                  responseCount: 0,
                  responseRate: 0,
                  interviewCount: 0,
                  interviewRate: 0,
                  rejectionCount: 0,
                  offerCount: 0,
                  ghostedCount: 0,
                  followUpDueCount: 1,
                  averageDaysToResponse: null,
                  lastUsedAt: new Date().toISOString(),
                  confidenceLevel: "insufficient_sample",
                  sampleSizeWarning: "2 attempts only — not enough evidence yet.",
                  recommendation: null,
                },
              ],
              byTrack: [
                {
                  cvVersion: "CTA Master",
                  scope: "track",
                  scopeValue: "clinical",
                  scopeLabel: "Clinical",
                  attemptCount: 2,
                  responseCount: 0,
                  responseRate: 0,
                  interviewCount: 0,
                  interviewRate: 0,
                  rejectionCount: 0,
                  offerCount: 0,
                  ghostedCount: 0,
                  followUpDueCount: 1,
                  averageDaysToResponse: null,
                  lastUsedAt: new Date().toISOString(),
                  confidenceLevel: "insufficient_sample",
                  sampleSizeWarning: "2 attempts only — not enough evidence yet.",
                  recommendation: null,
                },
              ],
              bySource: [],
              recommendations: {
                global: null,
                byTrack: [],
                bySource: [],
              },
            },
          },
        },
      })
    );

    expect(html).toContain("2 attempts · 0 responses · 0% response");
    expect(html).toContain("2 attempts only — not enough evidence yet.");
    expect(html).toContain("No response yet");
  });
});
