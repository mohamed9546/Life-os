import { NextResponse } from "next/server";
import { readCollection, Collections } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const log = await readCollection<Record<string, unknown>>(Collections.AI_LOG);
    const recent = log.slice(-50).reverse();
    return NextResponse.json({ log: recent, total: log.length });
  } catch {
    return NextResponse.json({ log: [], total: 0 });
  }
}
