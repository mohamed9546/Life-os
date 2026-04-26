import { opencodePath, readJsonFile, saveOpenCodeJson, saveOpenCodeText } from "./lib.mjs";

const FEEDS = [
  { id: "mhra-drug-safety", label: "MHRA Drug Safety Update", url: "https://www.gov.uk/drug-safety-update.atom" },
  { id: "mhra-alerts", label: "MHRA Drug and Device Alerts", url: "https://www.gov.uk/drug-device-alerts.atom" },
  { id: "fda-recalls", label: "FDA Recalls", url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml" },
];

const today = new Date().toISOString().slice(0, 10);
const seenPath = opencodePath("cache", "reg-watch-seen.json");
const seen = await readJsonFile(seenPath, {});
const fresh = [];

for (const feed of FEEDS) {
  try {
    const response = await fetch(feed.url, { headers: { Accept: "application/atom+xml, application/rss+xml, text/xml" } });
    if (!response.ok) {
      fresh.push({ feed: feed.label, error: `HTTP ${response.status}` });
      continue;
    }
    const xml = await response.text();
    for (const item of extractFeedItems(xml).slice(0, 12)) {
      const key = `${feed.id}:${item.link || item.id || item.title}`;
      if (seen[key]) continue;
      seen[key] = today;
      fresh.push({
        feed: feed.label,
        title: item.title,
        link: item.link,
        published: item.published,
        summary: item.summary,
      });
    }
  } catch (err) {
    fresh.push({ feed: feed.label, error: err instanceof Error ? err.message : "Feed fetch failed" });
  }
}

await saveOpenCodeJson("cache/reg-watch-seen.json", seen);
await saveOpenCodeText(
  `digests/regulatory/regulatory-${today}.md`,
  [
    `# Regulatory Watch ${today}`,
    ``,
    ...(fresh.length > 0
      ? fresh.map((item) =>
          item.error
            ? `- ${item.feed}: ${item.error}`
            : `- ${item.feed}: ${item.title}${item.published ? ` (${item.published})` : ""}\n  ${item.summary || ""}\n  ${item.link || ""}`
        )
      : ["- No new items across watched feeds."]),
    ``,
  ].join("\n")
);

console.log(JSON.stringify({ generatedAt: today, items: fresh.length }, null, 2));

function extractFeedItems(xml) {
  if (xml.includes("<feed")) {
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
    return entries.map(([, chunk]) => ({
      title: extractTag(chunk, "title"),
      link: extractAtomLink(chunk),
      published: extractTag(chunk, "updated") || extractTag(chunk, "published"),
      summary: stripXml(extractTag(chunk, "summary") || extractTag(chunk, "content")),
      id: extractTag(chunk, "id"),
    }));
  }

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return items.map(([, chunk]) => ({
    title: extractTag(chunk, "title"),
    link: extractTag(chunk, "link"),
    published: extractTag(chunk, "pubDate"),
    summary: stripXml(extractTag(chunk, "description")),
    id: extractTag(chunk, "guid"),
  }));
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

function extractAtomLink(xml) {
  const match = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || "";
}

function stripXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
