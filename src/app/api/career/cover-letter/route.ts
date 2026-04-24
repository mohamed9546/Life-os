import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      jobTitle: string;
      company: string;
      jobDescription: string;
      tone: string;
      highlights: string;
    };

    const { jobTitle, company, jobDescription, tone, highlights } = body;

    const prompt = `Write a cover letter for the following job. Return ONLY valid JSON, no markdown.

Job: ${jobTitle} at ${company}
Tone: ${tone}
${highlights ? `My key highlights: ${highlights}` : ""}

Job Description:
${jobDescription.slice(0, 2000)}

Return JSON:
{
  "subject": "email subject line",
  "body": "full cover letter text (3-4 paragraphs, no placeholders like [Your Name])",
  "tone": "${tone}",
  "wordCount": number
}`;

    const result = await callAI({ taskType: "cover-letter", prompt });

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error || "AI generation failed" }, { status: 500 });
    }

    const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
    const wordCount = (parsed.body || "").split(/\s+/).length;

    return NextResponse.json({ result: { ...parsed, wordCount } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate cover letter" },
      { status: 500 }
    );
  }
}
