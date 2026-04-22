import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getImportRecords } from "@/lib/imports/storage";
import { getJobStats } from "@/lib/jobs/storage";
import { getTransactions } from "@/lib/money/storage";
import { getRoutines } from "@/lib/routines/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const [records, jobStats, transactions, routines] = await Promise.all([
      getImportRecords(user.id),
      getJobStats(user.id),
      getTransactions(user.id),
      getRoutines(user.id),
    ]);

    return NextResponse.json({
      records,
      summary: {
        inboxJobs: jobStats.inbox,
        trackedJobs: jobStats.tracked,
        transactions: transactions.length,
        routines: routines.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load imports" },
      { status: 500 }
    );
  }
}
