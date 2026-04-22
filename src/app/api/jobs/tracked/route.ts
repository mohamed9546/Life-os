import { NextResponse } from "next/server";
import { getEnrichedJobs } from "@/lib/jobs/storage";
import { requireAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const jobs = await getEnrichedJobs(user.id);
    return NextResponse.json({ jobs, count: jobs.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
