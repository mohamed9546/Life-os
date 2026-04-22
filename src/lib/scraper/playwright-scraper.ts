// ============================================================
// Playwright-based scraper.
// Full headless browser for JavaScript-rendered pages.
// OPTIONAL — only loads if playwright is installed.
//
// Install: npx playwright install chromium && npm install playwright
// ============================================================

import { ScrapeRequest, ScrapeResult } from "./types";
import { loadScraperConfig } from "./config";

/**
 * Scrape using Playwright headless browser.
 * Falls back to cheerio if Playwright is not installed.
 */
export async function scrapeWithPlaywright(
  request: ScrapeRequest
): Promise<ScrapeResult> {
  const start = Date.now();
  const config = await loadScraperConfig();

  if (!config.playwright.enabled) {
    return {
      success: false,
      url: request.url,
      backend: "playwright",
      durationMs: Date.now() - start,
      error:
        "Playwright is not enabled. Install with: npx playwright install chromium && npm install playwright",
    };
  }

  try {
    // Dynamic import — only loads if playwright is installed
    let chromium: typeof import("playwright").chromium;
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch {
      return {
        success: false,
        url: request.url,
        backend: "playwright",
        durationMs: Date.now() - start,
        error:
          "Playwright is not installed. Run: npx playwright install chromium && npm install playwright",
      };
    }

    const browser = await chromium.launch({
      headless: config.playwright.headless,
    });

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "en-GB",
      });

      const page = await context.newPage();
      const timeoutMs = request.timeoutMs || config.playwright.timeoutMs;

      // Navigate to the page
      await page.goto(request.url, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // Wait for specific selector if provided
      if (request.waitForSelector) {
        await page
          .waitForSelector(request.waitForSelector, {
            timeout: timeoutMs / 2,
          })
          .catch(() => {
            console.warn(
              `[playwright] Selector "${request.waitForSelector}" not found, continuing`
            );
          });
      }

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(2000);

      // Extract content
      let html: string;
      let text: string;

      if (request.contentSelector) {
        const element = await page.$(request.contentSelector);
        html = element
          ? await element.innerHTML()
          : await page.content();
        text = element
          ? (await element.textContent()) || ""
          : await page.innerText("body");
      } else {
        html = await page.content();
        text = await page.innerText("body").catch(() => "");
      }

      // Extract title
      const title = await page.title();

      // Extract metadata
      const metadata = await page.evaluate(() => {
        const getMeta = (name: string) =>
          document
            .querySelector(
              `meta[name="${name}"], meta[property="${name}"]`
            )
            ?.getAttribute("content") || undefined;

        return {
          description: getMeta("description"),
          ogTitle: getMeta("og:title"),
          ogDescription: getMeta("og:description"),
          canonical:
            document
              .querySelector('link[rel="canonical"]')
              ?.getAttribute("href") || undefined,
        };
      });

      // Extract links if requested
      let links: Array<{ href: string; text: string }> | undefined;
      if (request.extractLinks) {
        links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((a) => ({
              href: (a as HTMLAnchorElement).href,
              text: (a as HTMLAnchorElement).textContent?.trim() || "",
            }))
            .filter((l) => l.href.startsWith("http"))
            .slice(0, 500);
        });
      }

      await context.close();

      return {
        success: true,
        url: request.url,
        backend: "playwright",
        html,
        text: text.replace(/\s+/g, " ").trim(),
        title,
        metadata,
        links,
        durationMs: Date.now() - start,
      };
    } finally {
      await browser.close();
    }
  } catch (err) {
    return {
      success: false,
      url: request.url,
      backend: "playwright",
      durationMs: Date.now() - start,
      error:
        err instanceof Error ? err.message : "Playwright scrape failed",
    };
  }
}