import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DEMO_EXHIBITOR_SNAPSHOT } from "./demoSeed";
import { hasFirecrawl, searchEventSource } from "./firecrawl";
import type { ResolvedSource } from "./fetchSource";
import { scrapeStatusFromMarkdown } from "./scrapeCache";
import { categorize } from "./sourceRank";

const MAX_FETCH_CHARS = 50_000;

export type ResolvedSourceCached = ResolvedSource & {
  scrapedPageId?: Id<"scrapedPage">;
};

/**
 * Resolve event source text using the global scrapedPage cache for any
 * Firecrawl markdown scrape (URL seed or event-name search).
 */
export async function resolveEventSourceTextCached(
  ctx: ActionCtx,
  eventSource: string,
): Promise<ResolvedSourceCached> {
  const trimmed = eventSource.trim();
  if (!trimmed) {
    return { text: DEMO_EXHIBITOR_SNAPSHOT, kind: "snapshot" };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const cached = await ctx.runAction(internal.scrapeCache.getOrScrapeOne, {
      url: trimmed,
      category: "event",
    });
    if (cached && cached.markdown.length >= 200) {
      return {
        text: cached.markdown.slice(0, MAX_FETCH_CHARS),
        url: cached.url,
        kind: "url",
        scrapedPageId: cached.scrapedPageId,
      };
    }

    const plain = await plainFetch(trimmed);
    if (plain) {
      return { text: plain, url: trimmed, kind: "url" };
    }

    return { text: DEMO_EXHIBITOR_SNAPSHOT, url: trimmed, kind: "snapshot" };
  }

  if (trimmed.includes("\n") || trimmed.length > 120) {
    return { text: trimmed.slice(0, MAX_FETCH_CHARS), kind: "paste" };
  }

  if (hasFirecrawl()) {
    const found = await searchEventSource(
      `${trimmed} exhibitor list sponsors speakers`,
    );
    if (found?.url && found.markdown) {
      const upserted = await ctx.runMutation(internal.scrapeCache.upsertBatch, {
        pages: [
          {
            url: found.url,
            markdown: found.markdown.slice(0, MAX_FETCH_CHARS),
            category: categorize(found.url, found.title ?? ""),
            scrapeStatus: scrapeStatusFromMarkdown(found.markdown),
          },
        ],
      });
      return {
        text: found.markdown.slice(0, MAX_FETCH_CHARS),
        url: found.url,
        kind: "url",
        scrapedPageId: upserted[0]?.scrapedPageId,
      };
    }
  }

  return { text: trimmed.slice(0, MAX_FETCH_CHARS), kind: "paste" };
}

import { plainFetch } from "./plainFetch";