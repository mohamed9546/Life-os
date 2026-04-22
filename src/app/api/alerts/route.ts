import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/lib/alerts/rules";
import { writeCollection } from "@/lib/storage";

export async function GET() {
  const alerts = await evaluateAlerts();
  return NextResponse.json({ alerts });
}

export async function POST() {
  const alerts = await evaluateAlerts();
  // Push critical alerts as notifications
  const notifs = alerts.filter(a => a.severity === "error" || a.severity === "warning").map(a => ({
    id: crypto.randomUUID(),
    title: a.title,
    body: a.body,
    type: a.severity === "error" ? "error" : "warning",
    read: false,
    createdAt: new Date().toISOString(),
  }));
  if (notifs.length > 0) {
    const { readCollection } = await import("@/lib/storage");
    const existing = await readCollection("notifications");
    await writeCollection("notifications", [...notifs, ...existing].slice(0, 50));
  }
  return NextResponse.json({ alerts, pushed: notifs.length });
}
