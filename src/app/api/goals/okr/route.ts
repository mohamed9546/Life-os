import { NextRequest, NextResponse } from "next/server";
import { readObject, writeObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

const FILE = "okr-data";

export async function GET() {
  try {
    const data = await readObject<{ objectives: unknown[] }>(FILE);
    return NextResponse.json({ objectives: data?.objectives ?? [] });
  } catch {
    return NextResponse.json({ objectives: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { objectives: unknown[] };
    await writeObject(FILE, { objectives: body.objectives, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
