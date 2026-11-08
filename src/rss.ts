import { XMLParser } from "fast-xml-parser";
import type { NewsSource } from "./sources";

export type RssItem = {
  id: string;
  url: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  sourceId: string;
  sourceName: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickLink(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const link = pickLink(item);
      if (link) return link;
    }
    return "";
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj["@_href"] === "string") return obj["@_href"];
    if (typeof obj["#text"] === "string") return obj["#text"];
  }
  return "";
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function hashId(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function parseFeedXml(xml: string, source: NewsSource): Omit<RssItem, "id">[] {
  const doc = parser.parse(xml);
  const channelItems = asArray(doc?.rss?.channel?.item);
  const atomEntries = asArray(doc?.feed?.entry);
  const items = channelItems.length ? channelItems : atomEntries;

  return items
    .map((item: Record<string, unknown>) => {
      const title = stripHtml(String(item.title ?? item["media:title"] ?? ""));
      const url =
        pickLink(item.link) ||
        pickLink(item.guid) ||
        pickLink(item.id) ||
        "";
      const summary = stripHtml(
        String(
          item.description ??
            item.summary ??
            item.content ??
            item["content:encoded"] ??
            "",
        ),
      ).slice(0, 1200);
      const publishedAt = String(
        item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? "",
      ).trim() || null;

      if (!title || !url) return null;
      return {
        url,
        title,
        summary,
        publishedAt,
        sourceId: source.id,
        sourceName: source.name,
      };
    })
    .filter((x): x is Omit<RssItem, "id"> => Boolean(x));
}

export async function fetchSourceItems(
  source: NewsSource,
  maxAgeHours: number,
): Promise<RssItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "geo-news-bot/1.0 (+cloudflare-workers)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ event: "rss_http_error", source: source.id, status: res.status }));
      return [];
    }
    const xml = await res.text();
    const cutoff = Date.now() - maxAgeHours * 3600_000;
    const parsed = parseFeedXml(xml, source);
    const out: RssItem[] = [];

    for (const item of parsed) {
      if (item.publishedAt) {
        const ts = Date.parse(item.publishedAt);
        if (!Number.isNaN(ts) && ts < cutoff) continue;
      }
      out.push({ ...item, id: await hashId(item.url) });
    }
    return out;
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "rss_fetch_failed",
        source: source.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}
