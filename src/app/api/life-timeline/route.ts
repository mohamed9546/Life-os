import { NextRequest, NextResponse } from "next/server";
import { readObject, writeObject } from "@/lib/storage";

export const dynamic = "force-dynamic";
const FILE = "life-timeline";

export async function GET() {
  try {
    const data = await readObject<{ events: unknown[] }>(FILE);
    return NextResponse.json({ events: data?.events ?? [] });
  } catch { return NextResponse.json({ events: [] }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { events: unknown[] };
    await writeObject(FILE, { events: body.events, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
