/**
 * TTL helpers for the global scrapedPage cache.
 */

export type ScrapeStatus = "ok" | "empty" | "failed";

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

const TTL_MS: Record<string, number> = {
  sponsors: 7 * MS_DAY,
  exhibitors: 7 * MS_DAY,
  speakers: 14 * MS_DAY,
  program: 14 * MS_DAY,
  news: 3 * MS_DAY,
  event: 7 * MS_DAY,
  past_edition: 14 * MS_DAY,
  other: 7 * MS_DAY,
  failed: 1 * MS_HOUR,
  empty: 1 * MS_HOUR,
};

export function cacheTtlMs(
  category: string | undefined,
  scrapeStatus: ScrapeStatus,
): number {
  if (scrapeStatus === "failed" || scrapeStatus === "empty") {
    return TTL_MS["failed"] ?? MS_HOUR;
  }
  const key = category ?? "other";
  return TTL_MS[key] ?? TTL_MS["other"] ?? 7 * MS_DAY;
}

export function isCacheFresh(
  fetchedAt: number,
  category: string | undefined,
  scrapeStatus: ScrapeStatus,
  now = Date.now(),
): boolean {
  return now - fetchedAt < cacheTtlMs(category, scrapeStatus);
}

export function scrapeStatusFromMarkdown(
  markdown: string,
): ScrapeStatus {
  const len = markdown.trim().length;
  if (len >= 200) return "ok";
  if (len === 0) return "failed";
  return "empty";
}

export function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `fnv1a:${hash.toString(16)}`;
}
