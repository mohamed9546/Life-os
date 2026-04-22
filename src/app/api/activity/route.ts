import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface ActivityEvent { id: string; timestamp: string; type: string; module: string; title: string; href?: string; }

export async function GET() {
  const events = await readCollection<ActivityEvent>("activity-log");
  return NextResponse.json({ events: events.slice(-100).reverse() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = await readCollection<ActivityEvent>("activity-log");
  const event: ActivityEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: body.type,
    module: body.module,
    title: body.title,
    href: body.href,
  };
  events.push(event);
  await writeCollection<ActivityEvent>("activity-log", events.slice(-500));
  return NextResponse.json({ event });
}
