import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/jobs/storage";
import { generateLinkedInIntro } from "@/lib/ai/tasks/generate-linkedin-intro";

export async function POST(req: NextRequest) {
  let personId: string;
  let jobId: string;
  try {
    const body = (await req.json()) as { personId?: string; jobId?: string };
    if (!body.personId || !body.jobId) {
      return NextResponse.json({ error: "personId and jobId are required" }, { status: 400 });
    }
    personId = body.personId;
    jobId = body.jobId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const job = await getJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const parsedJob = job.parsed?.data;
  if (!parsedJob) {
    return NextResponse.json({ error: "Job has not been parsed yet" }, { status: 422 });
  }

  const person = job.decisionMakers?.find((dm) => dm.id === personId);
  if (!person) {
    return NextResponse.json({ error: "Decision maker not found on this job" }, { status: 404 });
  }

  const intro = await generateLinkedInIntro(person, parsedJob, job.companyIntel ?? null);

  return NextResponse.json({ intro, charCount: intro.length });
}
