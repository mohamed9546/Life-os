// ============================================================
// GET /api/scraper/health
// Check scraper backends availability.
// ============================================================

import { NextResponse } from "next/server";
import { checkFirecrawlHealth } from "@/lib/scraper";
import { loadScraperConfig } from "@/lib/scraper/config";

export async function GET() {
  try {
    const config = await loadScraperConfig();
    const firecrawl = await checkFirecrawlHealth();

    return NextResponse.json({
      backends: {
        cheerio: { available: true, note: "Always available - lightweight HTML parser" },
        firecrawl: {
          available: firecrawl.available,
          enabled: config.firecrawl.enabled,
          baseUrl: config.firecrawl.baseUrl,
          error: firecrawl.error,
          note: "Self-host with: docker run -p 3002:3002 mendableai/firecrawl",
        },
        playwright: {
          enabled: config.playwright.enabled,
          note: "Install with: npx playwright install chromium && npm install playwright",
        },
      },
      rateLimit: config.rateLimit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Health check failed" },
      { status: 500 }
    );
  }
}
