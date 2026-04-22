import { NextResponse } from "next/server";
import { readCollection, Collections } from "@/lib/storage";
import { differenceInDays } from "date-fns";

export const dynamic = "force-dynamic";

async function getCollectionHealth(
  collection: string,
  label: string,
  description: string,
  staleAfterDays = 7
) {
  try {
    const items = await readCollection<Record<string, unknown>>(collection);
    if (items.length === 0) return { module: collection, label, status: "empty" as const, count: 0, lastUpdated: null, description };

    const dates = items
      .map((i) => (i.updatedAt || i.createdAt || i.date || i.fetchedAt) as string)
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));

    const lastUpdated = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null;
    const daysSinceUpdate = lastUpdated ? differenceInDays(new Date(), new Date(lastUpdated)) : 999;

    const status = daysSinceUpdate > staleAfterDays ? "stale" : "healthy";
    return { module: collection, label, status, count: items.length, lastUpdated, description };
  } catch {
    return { module: collection, label, status: "empty" as const, count: 0, lastUpdated: null, description };
  }
}

export async function GET() {
  const modules = await Promise.all([
    getCollectionHealth("goals", "Goals", "Active goals and milestones", 14),
    getCollectionHealth(Collections.ROUTINES, "Routines", "Daily habits and check-ins", 2),
    getCollectionHealth(Collections.DECISIONS, "Decisions", "Open and resolved decisions", 30),
    getCollectionHealth(Collections.TRANSACTIONS, "Transactions", "Financial transactions", 7),
    getCollectionHealth("contacts", "Contacts", "Network contacts", 30),
    getCollectionHealth("budgets", "Budgets", "Monthly budget categories", 14),
    getCollectionHealth("net-worth", "Net Worth", "Net worth snapshots", 30),
    getCollectionHealth("journal", "Journal", "Journal entries", 3),
    getCollectionHealth("health-log", "Health Log", "Energy, mood, sleep logs", 2),
    getCollectionHealth("gratitude-log", "Gratitude", "Daily gratitude entries", 2),
    getCollectionHealth("learning", "Learning", "Learning items and resources", 14),
    getCollectionHealth(Collections.AI_LOG, "AI Activity", "AI task executions", 3),
  ]);

  return NextResponse.json({ modules });
}
