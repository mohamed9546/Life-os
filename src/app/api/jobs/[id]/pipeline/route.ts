import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { updateStoredJob } from "@/lib/jobs/storage";
import { UserJobStatus } from "@/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: UserJobStatus[] = [
  "inbox", "tracked", "applied", "archived", "rejected",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAppUser();
    const body = await request.json() as { status?: string; notes?: string };

    const { status, notes } = body;

    if (!status || !VALID_STATUSES.includes(status as UserJobStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const ok = await updateStoredJob(
      params.id,
      (job) => ({
        ...job,
        status: status as UserJobStatus,
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date().toISOString(),
      }),
      user.id
    );

    if (!ok) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update job pipeline" },
      { status: 500 }
    );
  }
}
