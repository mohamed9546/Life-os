// ============================================================
// Cheerio-based scraper.
// Lightweight HTTP fetch + HTML parsing. No browser needed.
// Best for: most job board pages, company career pages,
// any page that doesn't require JavaScript rendering.
// ============================================================

import * as cheerio from "cheerio";
import { ScrapeRequest, ScrapeResult } from "./types";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function scrapeWithCheerio(
  request: ScrapeRequest
): Promise<ScrapeResult> {
  const start = Date.now();

  try {
    const timeoutMs = request.timeoutMs || 15_000;

    const response = await fetch(request.url, {
      method: "GET",
      headers: {
        ...DEFAULT_HEADERS,
        ...(request.headers || {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        success: false,
        url: request.url,
        backend: "cheerio",
        durationMs: Date.now() - start,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, and other noise
    $(
      "script, style, noscript, iframe, svg, nav, footer, header"
    ).remove();

    // Extract content from specific selector if provided
    let contentHtml: string;
    let contentText: string;

    if (request.contentSelector) {
      const selected = $(request.contentSelector);
      contentHtml = selected.html() || "";
      contentText = selected.text().replace(/\s+/g, " ").trim();
    } else {
      // Get main content area — try common selectors
      const mainContent =
        $("main").html() ||
        $("article").html() ||
        $('[role="main"]').html() ||
        $(".job-description").html() ||
        $(".job-detail").html() ||
        $(".content").html() ||
        $("body").html() ||
        "";

      contentHtml = mainContent;
      contentText = $("body").text().replace(/\s+/g, " ").trim();
    }

    // Extract metadata
    const metadata: Record<string, string | undefined> = {
      description:
        $('meta[name="description"]').attr("content") || undefined,
      ogTitle: $('meta[property="og:title"]').attr("content") || undefined,
      ogDescription:
        $('meta[property="og:description"]').attr("content") || undefined,
      canonical:
        $('link[rel="canonical"]').attr("href") || undefined,
    };

    // Extract JSON-LD structured data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const jsonLdData: unknown[] = [];
    jsonLdScripts.each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || "");
        jsonLdData.push(data);
      } catch {
        // Skip invalid JSON-LD
      }
    });

    if (jsonLdData.length > 0) {
      metadata.jsonLd = JSON.stringify(jsonLdData);
    }

    // Extract links if requested
    let links: Array<{ href: string; text: string }> | undefined;
    if (request.extractLinks) {
      links = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (href && text && href.startsWith("http")) {
          links!.push({ href, text: text.slice(0, 200) });
        }
      });
    }

    return {
      success: true,
      url: request.url,
      backend: "cheerio",
      html: contentHtml,
      text: contentText,
      title: $("title").text().trim() || metadata.ogTitle || undefined,
      metadata,
      links,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      url: request.url,
      backend: "cheerio",
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Cheerio scrape failed",
    };
  }
}

/**
 * Extract all job listing links from a careers/job board page.
 * Useful for scraping company career pages that list multiple jobs.
 */
export async function extractJobLinksFromPage(
  url: string
): Promise<Array<{ href: string; title: string }>> {
  const result = await scrapeWithCheerio({
    url,
    extractLinks: true,
    timeoutMs: 15_000,
  });

  if (!result.success || !result.links) return [];

  // Filter for links that look like job postings
  const jobPatterns = [
    /\/jobs?\//i,
    /\/careers?\//i,
    /\/positions?\//i,
    /\/openings?\//i,
    /\/vacancies?\//i,
    /\/opportunity/i,
    /\/apply/i,
    /jobId=/i,
    /job_id=/i,
    /posting/i,
  ];

  return result.links
    .filter((link) => jobPatterns.some((p) => p.test(link.href)))
    .map((link) => ({
      href: link.href,
      title: link.text,
    }));
}