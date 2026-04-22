// ============================================================
// POST /api/scraper/scrape-job
// Scrape a single job URL and extract structured data.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { scrapeJobPage } from "@/lib/scraper";

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

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    const result = await scrapeJobPage(url);

    return NextResponse.json({
      success: !!result.job,
      job: result.job,
      scraped: result.scraped,
      error: result.error,
    });
  } catch (err) {
    console.error("[api/scraper/scrape-job] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Scrape failed",
      },
      { status: 500 }
    );
  }
}
