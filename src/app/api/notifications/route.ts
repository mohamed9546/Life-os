import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

const KEY = "notifications";

export async function GET() {
  const notifications = await readCollection<Notification>(KEY);
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const notifications = await readCollection<Notification>(KEY);
  const newNotif: Notification = {
    id: crypto.randomUUID(),
    title: body.title ?? "Notification",
    body: body.body ?? "",
    type: body.type ?? "info",
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(newNotif);
  const trimmed = notifications.slice(0, 50);
  await writeCollection<Notification>(KEY, trimmed);
  return NextResponse.json({ notification: newNotif });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const notifications = await readCollection<Notification>(KEY);
  if (body.action === "mark-all-read") {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    await writeCollection<Notification>(KEY, updated);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await writeCollection<Notification>(KEY, []);
  return NextResponse.json({ ok: true });
}
