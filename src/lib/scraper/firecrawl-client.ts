// ============================================================
// Firecrawl client.
// Firecrawl is an open-source web scraping API that can be
// self-hosted locally via Docker, or used as a cloud service.
//
// Self-host: docker run -p 3002:3002 mendableai/firecrawl
// Docs: https://docs.firecrawl.dev
//
// Firecrawl is superior to basic scraping because it:
// - Handles JavaScript rendering
// - Returns clean markdown
// - Extracts structured data
// - Handles anti-bot measures
// - Can crawl entire sites
// ============================================================

import { ScrapeRequest, ScrapeResult } from "./types";
import { loadScraperConfig } from "./config";

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    content: string; // markdown
    markdown: string;
    html: string;
    rawHtml: string;
    metadata: {
      title: string;
      description: string;
      language: string;
      sourceURL: string;
      ogTitle?: string;
      ogDescription?: string;
      [key: string]: unknown;
    };
    links?: string[];
  };
  error?: string;
}

interface FirecrawlCrawlResponse {
  success: boolean;
  jobId: string;
}

interface FirecrawlCrawlStatus {
  success: boolean;
  status: "scraping" | "completed" | "failed";
  completed: number;
  total: number;
  data?: Array<{
    content: string;
    markdown: string;
    metadata: Record<string, unknown>;
    sourceURL: string;
  }>;
}

export async function scrapeWithFirecrawl(
  request: ScrapeRequest
): Promise<ScrapeResult> {
  const start = Date.now();
  const config = await loadScraperConfig();

  if (!config.firecrawl.enabled) {
    return {
      success: false,
      url: request.url,
      backend: "firecrawl",
      durationMs: Date.now() - start,
      error: "Firecrawl is not enabled. Enable in Settings or self-host with Docker.",
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API key if configured (for cloud Firecrawl)
    if (config.firecrawl.apiKey) {
      headers["Authorization"] = `Bearer ${config.firecrawl.apiKey}`;
    }

    const body: Record<string, unknown> = {
      url: request.url,
      formats: ["html", "markdown"],
      onlyMainContent: true,
    };

    if (request.waitForSelector) {
      body.waitFor = request.waitForSelector;
    }

    if (request.timeoutMs) {
      body.timeout = request.timeoutMs;
    }

    const response = await fetch(
      `${config.firecrawl.baseUrl}/v1/scrape`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(request.timeoutMs || 30_000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`Firecrawl returned ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as FirecrawlScrapeResponse;

    if (!data.success || !data.data) {
      return {
        success: false,
        url: request.url,
        backend: "firecrawl",
        durationMs: Date.now() - start,
        error: data.error || "Firecrawl scrape returned no data",
      };
    }

    return {
      success: true,
      url: request.url,
      backend: "firecrawl",
      html: data.data.html || data.data.rawHtml,
      text: data.data.markdown || data.data.content,
      title: data.data.metadata?.title,
      metadata: {
        description: data.data.metadata?.description,
        ogTitle: data.data.metadata?.ogTitle,
        ogDescription: data.data.metadata?.ogDescription,
        sourceURL: data.data.metadata?.sourceURL,
      },
      links: data.data.links?.map((href) => ({ href, text: "" })),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      url: request.url,
      backend: "firecrawl",
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Firecrawl scrape failed",
    };
  }
}

/**
 * Check if Firecrawl (self-hosted or cloud) is available.
 */
export async function checkFirecrawlHealth(): Promise<{
  available: boolean;
  baseUrl: string;
  error?: string;
}> {
  const config = await loadScraperConfig();

  if (!config.firecrawl.enabled) {
    return {
      available: false,
      baseUrl: config.firecrawl.baseUrl,
      error: "Firecrawl is disabled",
    };
  }

  try {
    const response = await fetch(config.firecrawl.baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });

    return {
      available: response.ok || response.status === 404, // 404 is fine — server is running
      baseUrl: config.firecrawl.baseUrl,
    };
  } catch (err) {
    return {
      available: false,
      baseUrl: config.firecrawl.baseUrl,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Crawl an entire job board / career site.
 * Returns all pages found. Great for company career pages.
 */
export async function crawlJobSite(
  baseUrl: string,
  options?: {
    maxPages?: number;
    includePattern?: string;
    excludePattern?: string;
  }
): Promise<{
  success: boolean;
  pages: Array<{ url: string; content: string }>;
  error?: string;
}> {
  const config = await loadScraperConfig();

  if (!config.firecrawl.enabled) {
    return {
      success: false,
      pages: [],
      error: "Firecrawl is not enabled",
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.firecrawl.apiKey) {
      headers["Authorization"] = `Bearer ${config.firecrawl.apiKey}`;
    }

    // Start crawl
    const crawlResponse = await fetch(
      `${config.firecrawl.baseUrl}/v1/crawl`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: baseUrl,
          limit: options?.maxPages || 50,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
          ...(options?.includePattern && {
            includePaths: [options.includePattern],
          }),
          ...(options?.excludePattern && {
            excludePaths: [options.excludePattern],
          }),
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!crawlResponse.ok) {
      throw new Error(`Crawl start failed: ${crawlResponse.status}`);
    }

    const crawlData = (await crawlResponse.json()) as FirecrawlCrawlResponse;

    if (!crawlData.success || !crawlData.jobId) {
      throw new Error("Crawl job creation failed");
    }

    // Poll for results (max 5 minutes)
    const maxWaitMs = 300_000;
    const pollInterval = 5_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const statusResponse = await fetch(
        `${config.firecrawl.baseUrl}/v1/crawl/${crawlData.jobId}`,
        { headers, signal: AbortSignal.timeout(10_000) }
      );

      if (!statusResponse.ok) continue;

      const status =
        (await statusResponse.json()) as FirecrawlCrawlStatus;

      if (status.status === "completed" && status.data) {
        return {
          success: true,
          pages: status.data.map((d) => ({
            url: d.sourceURL,
            content: d.markdown || d.content,
          })),
        };
      }

      if (status.status === "failed") {
        return {
          success: false,
          pages: [],
          error: "Crawl job failed",
        };
      }

      console.log(
        `[firecrawl] Crawl progress: ${status.completed}/${status.total}`
      );
    }

    return {
      success: false,
      pages: [],
      error: "Crawl timed out after 5 minutes",
    };
  } catch (err) {
    return {
      success: false,
      pages: [],
      error: err instanceof Error ? err.message : "Crawl failed",
    };
  }
}