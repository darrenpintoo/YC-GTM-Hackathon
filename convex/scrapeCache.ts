import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { batchScrape } from "./lib/firecrawl";
import { plainFetch } from "./lib/plainFetch";
import {
  hashContent,
  isCacheFresh,
  scrapeStatusFromMarkdown,
  type ScrapeStatus,
} from "./lib/scrapeCache";
import { normalizeUrl } from "./lib/sourceRank";

const scrapeStatusValidator = v.union(
  v.literal("ok"),
  v.literal("empty"),
  v.literal("failed"),
);

const scrapedPageResultValidator = v.object({
  url: v.string(),
  markdown: v.string(),
  scrapedPageId: v.id("scrapedPage"),
  scrapeStatus: scrapeStatusValidator,
  fromCache: v.boolean(),
});

/** Batch lookup cached pages by normalized URL. */
export const lookupBatch = internalQuery({
  args: {
    urls: v.array(v.string()),
    categories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const out: Array<{
      url: string;
      normalizedUrl: string;
      hit: boolean;
      scrapedPageId?: Id<"scrapedPage">;
      markdown?: string;
      contentHash?: string;
      scrapeStatus?: ScrapeStatus;
    }> = [];

    for (let i = 0; i < args.urls.length; i++) {
      const url = args.urls[i]!;
      const normalizedUrl = normalizeUrl(url);
      const category = args.categories?.[i];

      const row = await ctx.db
        .query("scrapedPage")
        .withIndex("by_normalized_url", (q) =>
          q.eq("normalizedUrl", normalizedUrl),
        )
        .unique();

      if (
        row &&
        row.scrapeStatus === "ok" &&
        row.markdown.length >= 200 &&
        isCacheFresh(row.fetchedAt, row.category ?? category, row.scrapeStatus)
      ) {
        out.push({
          url,
          normalizedUrl,
          hit: true,
          scrapedPageId: row._id,
          markdown: row.markdown,
          contentHash: row.contentHash,
          scrapeStatus: row.scrapeStatus,
        });
      } else {
        out.push({ url, normalizedUrl, hit: false });
      }
    }

    return out;
  },
});

/** Upsert scraped pages; returns url → scrapedPageId for each row. */
export const upsertBatch = internalMutation({
  args: {
    pages: v.array(
      v.object({
        url: v.string(),
        markdown: v.string(),
        category: v.optional(v.string()),
        scrapeStatus: scrapeStatusValidator,
      }),
    ),
  },
  returns: v.array(
    v.object({
      url: v.string(),
      scrapedPageId: v.id("scrapedPage"),
    }),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const out: Array<{ url: string; scrapedPageId: Id<"scrapedPage"> }> = [];

    for (const page of args.pages) {
      const normalizedUrl = normalizeUrl(page.url);
      const contentHash = hashContent(page.markdown);
      const charCount = page.markdown.length;

      const existing = await ctx.db
        .query("scrapedPage")
        .withIndex("by_normalized_url", (q) =>
          q.eq("normalizedUrl", normalizedUrl),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          url: page.url,
          markdown: page.markdown,
          contentHash,
          charCount,
          scrapeStatus: page.scrapeStatus,
          category: page.category ?? existing.category,
          fetchedAt: now,
          failCount:
            page.scrapeStatus === "failed"
              ? existing.failCount + 1
              : existing.failCount,
        });
        out.push({ url: page.url, scrapedPageId: existing._id });
      } else {
        const id = await ctx.db.insert("scrapedPage", {
          normalizedUrl,
          url: page.url,
          markdown: page.markdown,
          contentHash,
          charCount,
          scrapeStatus: page.scrapeStatus,
          category: page.category,
          fetchedAt: now,
          hitCount: 0,
          failCount: page.scrapeStatus === "failed" ? 1 : 0,
        });
        out.push({ url: page.url, scrapedPageId: id });
      }
    }

    return out;
  },
});

/** Increment hitCount when serving from cache. */
export const recordHits = internalMutation({
  args: { scrapedPageIds: v.array(v.id("scrapedPage")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const id of args.scrapedPageIds) {
      const row = await ctx.db.get(id);
      if (row) {
        await ctx.db.patch(id, { hitCount: row.hitCount + 1 });
      }
    }
    return null;
  },
});

/**
 * Check scrapedPage cache, scrape misses via Firecrawl, upsert, return all pages.
 */
export const getOrScrapeBatch = internalAction({
  args: {
    urls: v.array(v.string()),
    categories: v.optional(v.array(v.string())),
  },
  returns: v.object({
    pages: v.array(scrapedPageResultValidator),
    cacheHits: v.number(),
    cacheMisses: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.urls.length === 0) {
      return { pages: [], cacheHits: 0, cacheMisses: 0 };
    }

    const lookups = await ctx.runQuery(internal.scrapeCache.lookupBatch, {
      urls: args.urls,
      categories: args.categories,
    });

    const results: Array<{
      url: string;
      markdown: string;
      scrapedPageId: Id<"scrapedPage">;
      scrapeStatus: ScrapeStatus;
      fromCache: boolean;
    }> = [];

    const missUrls: string[] = [];
    const missCategories: (string | undefined)[] = [];
    const hitIds: Id<"scrapedPage">[] = [];

    for (let i = 0; i < lookups.length; i++) {
      const lookup = lookups[i]!;
      if (lookup.hit && lookup.scrapedPageId && lookup.markdown != null) {
        results.push({
          url: lookup.url,
          markdown: lookup.markdown,
          scrapedPageId: lookup.scrapedPageId,
          scrapeStatus: lookup.scrapeStatus ?? "ok",
          fromCache: true,
        });
        hitIds.push(lookup.scrapedPageId);
      } else {
        missUrls.push(lookup.url);
        missCategories.push(args.categories?.[i]);
      }
    }

    if (hitIds.length > 0) {
      await ctx.runMutation(internal.scrapeCache.recordHits, {
        scrapedPageIds: hitIds,
      });
    }

    if (missUrls.length > 0) {
      const scraped = await batchScrape(missUrls);
      const scrapedByNorm = new Map(
        scraped.map((d) => [normalizeUrl(d.url), d]),
      );

      const toUpsert: Array<{
        url: string;
        markdown: string;
        category?: string;
        scrapeStatus: ScrapeStatus;
      }> = [];

      for (let i = 0; i < missUrls.length; i++) {
        const url = missUrls[i]!;
        const doc = scrapedByNorm.get(normalizeUrl(url));
        let markdown = doc?.markdown ?? "";
        let resolvedUrl = doc?.url ?? url;

        if (markdown.length < 200) {
          const plain = await plainFetch(url);
          if (plain) {
            markdown = plain;
            resolvedUrl = url;
          }
        }

        toUpsert.push({
          url: resolvedUrl,
          markdown,
          category: missCategories[i],
          scrapeStatus: scrapeStatusFromMarkdown(markdown),
        });
      }

      const upserted: Array<{ url: string; scrapedPageId: Id<"scrapedPage"> }> =
        await ctx.runMutation(internal.scrapeCache.upsertBatch, {
          pages: toUpsert,
        });
      const idByUrl = new Map(
        upserted.map((r: { url: string; scrapedPageId: Id<"scrapedPage"> }) => [
          normalizeUrl(r.url),
          r,
        ]),
      );

      for (const page of toUpsert) {
        const row = idByUrl.get(normalizeUrl(page.url));
        if (!row) continue;
        results.push({
          url: page.url,
          markdown: page.markdown,
          scrapedPageId: row.scrapedPageId,
          scrapeStatus: page.scrapeStatus,
          fromCache: false,
        });
      }
    }

    const cacheHits = results.filter((r) => r.fromCache).length;
    const cacheMisses = results.filter((r) => !r.fromCache).length;

    console.log(
      `Bronze scrape cache: ${cacheHits} hits, ${cacheMisses} misses (${args.urls.length} urls)`,
    );

    return { pages: results, cacheHits, cacheMisses };
  },
});

/** Single-URL wrapper around getOrScrapeBatch. */
export const getOrScrapeOne = internalAction({
  args: {
    url: v.string(),
    category: v.optional(v.string()),
  },
  returns: v.union(scrapedPageResultValidator, v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<{
    url: string;
    markdown: string;
    scrapedPageId: Id<"scrapedPage">;
    scrapeStatus: ScrapeStatus;
    fromCache: boolean;
  } | null> => {
    const batch: {
      pages: Array<{
        url: string;
        markdown: string;
        scrapedPageId: Id<"scrapedPage">;
        scrapeStatus: ScrapeStatus;
        fromCache: boolean;
      }>;
    } = await ctx.runAction(internal.scrapeCache.getOrScrapeBatch, {
      urls: [args.url],
      categories: args.category ? [args.category] : undefined,
    });
    return batch.pages[0] ?? null;
  },
});
