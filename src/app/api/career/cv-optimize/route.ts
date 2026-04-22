import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cvText, jobDescription, jobTitle } = body;

  const prompt = `You are an expert CV reviewer. Analyse this CV against the job description.

JOB${jobTitle ? ` (${jobTitle})` : ""}:
${String(jobDescription).slice(0, 1000)}

CV:
${String(cvText).slice(0, 2000)}

Return JSON: {
  "atsScore": <0-100 integer>,
  "summary": "<one sentence assessment>",
  "keywordGaps": ["keyword1", "keyword2"],
  "suggestions": [{ "section": "Summary|Experience|Skills", "original": "...", "improved": "..." }]
}
Provide 3-5 concrete suggestions.`;

  const result = await callAI({
    taskType: "cv-optimize",
    prompt,
    maxTokens: 2000,
  });

  if (!result.success) return NextResponse.json({ result: null }, { status: 500 });

  return NextResponse.json({ result: result.data });
}
