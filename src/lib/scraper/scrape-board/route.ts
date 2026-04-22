// ============================================================
// POST /api/scraper/scrape-board
// Scrape a career page / job board and extract all listings.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { scrapeJobBoard } from "@/lib/scraper";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    const result = await scrapeJobBoard(url);

    return NextResponse.json({
      success: result.jobs.length > 0,
      jobs: result.jobs,
      total: result.total,
      error: result.error,
    });
  } catch (err) {
    console.error("[api/scraper/scrape-board] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Board scrape failed",
      },
      { status: 500 }
    );
  }
}
