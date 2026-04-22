import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface Snapshot { id: string; date: string; assets: Record<string, number>; liabilities: Record<string, number>; netWorth: number; }

export async function GET() {
  const snapshots = await readCollection<Snapshot>("net-worth");
  return NextResponse.json({ snapshots });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const snapshots = await readCollection<Snapshot>("net-worth");
  const totalAssets = Object.values(body.assets as Record<string, number>).reduce((a, b) => a + b, 0);
  const totalLiabs  = Object.values(body.liabilities as Record<string, number>).reduce((a, b) => a + b, 0);
  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    assets: body.assets,
    liabilities: body.liabilities,
    netWorth: totalAssets - totalLiabs,
  };
  snapshots.push(snapshot);
  await writeCollection<Snapshot>("net-worth", snapshots);
  return NextResponse.json({ snapshot });
}
