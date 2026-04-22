import { NextRequest, NextResponse } from "next/server";
import { readCollection } from "@/lib/storage";

type SupportedModule = "jobs" | "transactions" | "decisions" | "routines" | "goals" | "contacts" | "learning";

const MODULE_COLLECTIONS: Record<SupportedModule, string> = {
  jobs: "jobs-ranked",
  transactions: "transactions",
  decisions: "decisions",
  routines: "routines",
  goals: "goals",
  contacts: "contacts",
  learning: "learning",
};

function toCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const moduleName = searchParams.get("module") as SupportedModule | null;
  const format = searchParams.get("format") ?? "csv";

  if (!moduleName || !MODULE_COLLECTIONS[moduleName]) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  const data = await readCollection<Record<string, unknown>>(
    MODULE_COLLECTIONS[moduleName]
  );

  if (format === "csv") {
    const csv = toCSV(data);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="life-os-${moduleName}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ data });
}
