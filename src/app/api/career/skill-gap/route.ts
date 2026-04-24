import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { jobDescription, mySkills, jobTitle } = await request.json() as {
      jobDescription: string;
      mySkills: string;
      jobTitle?: string;
    };

    const prompt = `Analyse the skill gap between a candidate and a job. Return ONLY valid JSON.

${jobTitle ? `Job Title: ${jobTitle}` : ""}

Job Description:
${jobDescription.slice(0, 2000)}

Candidate Skills:
${mySkills}

Return JSON:
{
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "niceToHave": ["skill1"],
  "matchScore": 0-100,
  "summary": "2-sentence honest assessment",
  "learningPriorities": [
    { "skill": "name", "reason": "why critical for this role", "resource": "suggested resource or approach" }
  ]
}

learningPriorities should have max 3 items, ranked by importance.`;

    const result = await callAI({ taskType: "skill-gap", prompt });

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error || "AI failed" }, { status: 500 });
    }

    const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
    return NextResponse.json({ result: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Skill gap analysis failed" },
      { status: 500 }
    );
  }
}
