import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { parseLinkedInAlertText } from "@/lib/jobs/sources/linkedin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = await request.json();
    const { input } = body as { input?: string };

    if (!input?.trim()) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const normalized = input.toLowerCase();
    const linkedInAlerts = parseLinkedInAlertText(input);
    const previews: Array<{
      type: "job" | "recruiter-email" | "decision-note" | "money-note" | "candidate-profile";
      confidence: number;
      summary: string;
      destination: string;
    }> = [];

    if (linkedInAlerts.length > 0) {
      previews.push({
        type: "job",
        confidence: 0.95,
        summary: `Detected a job alert batch with ${linkedInAlerts.length} likely job entries.`,
        destination: "Career inbox",
      });
    }

    if (normalized.includes("curriculum vitae") || normalized.includes("professional summary")) {
      previews.push({
        type: "candidate-profile",
        confidence: 0.75,
        summary: "Detected CV/profile-style content that could improve your candidate profile.",
        destination: "Candidate profile draft",
      });
    }

    if (
      normalized.includes("hiring manager") ||
      normalized.includes("dear") ||
      normalized.includes("opportunity")
    ) {
      previews.push({
        type: "recruiter-email",
        confidence: 0.72,
        summary: "Looks like recruiter or hiring outreach text that can be routed into Career intake.",
        destination: "Career job intake",
      });
    }

    if (
      normalized.includes("option") ||
      normalized.includes("decision") ||
      normalized.includes("tradeoff")
    ) {
      previews.push({
        type: "decision-note",
        confidence: 0.66,
        summary: "Looks like decision framing text that could be turned into a decision entry.",
        destination: "Decisions workspace",
      });
    }

    if (
      normalized.includes("tesco") ||
      normalized.includes("payment") ||
      normalized.includes("spent") ||
      normalized.includes("bank")
    ) {
      previews.push({
        type: "money-note",
        confidence: 0.58,
        summary: "Looks like transaction or spending text that belongs in Money intake.",
        destination: "Money import workflow",
      });
    }

    if (previews.length === 0) {
      previews.push({
        type: "job",
        confidence: 0.45,
        summary: "Defaulting to job-oriented text preview because the content looks unstructured but role-related.",
        destination: "Career intake preview",
      });
    }

    return NextResponse.json({ success: true, previews });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to preview import text" },
      { status: 500 }
    );
  }
}
