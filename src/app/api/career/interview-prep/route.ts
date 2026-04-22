import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, company, description } = body;

  const prompt = `Generate 12 interview questions for this role.
Title: ${title}
Company: ${company}
${description ? `JD excerpt: ${String(description).slice(0, 800)}` : ""}

Return a JSON array only: [{ "category": "Technical|Behavioural|Company|Role", "question": "...", "modelAnswer": "..." }]
Mix: 3 Technical, 4 Behavioural (STAR format), 3 Company-specific, 2 Role-specific.`;

  const result = await callAI<{ questions: unknown[] }>({
    taskType: "interview-prep",
    prompt,
    maxTokens: 2000,
  });

  if (!result.success) return NextResponse.json({ questions: [] }, { status: 500 });

  const questions = Array.isArray(result.data)
    ? result.data
    : (result.data as Record<string, unknown>)?.questions ?? [];

  return NextResponse.json({ questions });
}
