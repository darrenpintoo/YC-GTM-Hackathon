import { resolveEventSourceTextCached } from "./lib/fetchSourceCached";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  hasFirecrawl,
  mapSite,
  searchEventSource,
  searchUrls,
  type MappedLink,
} from "./lib/firecrawl";
import { scrapeStatusFromMarkdown } from "./lib/scrapeCache";
import { callOpenAiJson, callOpenAiWebSearch } from "./lib/openai";
import {
  categorize,
  dedupeCandidates,
  hostOf,
  normalizeUrl,
  rankCandidates,
  rankLinks,
  selectCandidates,
  type RankedCandidate,
  type SignalTier,
} from "./lib/sourceRank";
import {
  eventMetaSchema,
  sourceDiscoverySchema,
  sourceTriageSchema,
  type EventMetaOutput,
  type SourceDiscoveryOutput,
  type SourceTriageOutput,
} from "../lib/aiSchemas";

const THIN_CORPUS_CHARS = 1500;
const TRIAGE_TOP_N = 80;

type GatherResult = {
  sourceCount: number;
  thin: boolean;
};

type RawCandidate = Omit<RankedCandidate, "discoveryScore">;

/**
 * Deep-research gathering phase. Discovers many candidate pages (site map +
 * web search), scores and triages them, scrapes high-signal pages (with global
 * cache), persists each as a source document, and extracts event metadata.
 */
export const gather = internalAction({
  args: {
    eventId: v.id("event"),
    eventName: v.string(),
    eventSource: v.string(),
    warmCache: v.optional(v.boolean()),
  },
  returns: v.object({ sourceCount: v.number(), thin: v.boolean() }),
  handler: async (ctx, args): Promise<GatherResult> => {
    await ctx.runMutation(internal.ingest.clearSources, {
      eventId: args.eventId,
    });
    await ctx.runMutation(internal.ingest.updateGatherProgress, {
      eventId: args.eventId,
      message: args.warmCache
        ? "Discovering sources (warm-cache replay)…"
        : "Discovering sources across the web…",
      progress: 8,
    });

    const seedTrim = args.eventSource.trim();
    const seedIsUrl = /^https?:\/\//i.test(seedTrim);
    const seedHost = seedIsUrl ? hostOf(seedTrim) : undefined;

    const raw = await discoverUrls(ctx, args.eventName, args.eventSource);
    const deduped = dedupeCandidates(raw, extractYear(args.eventName) ?? undefined);
    let ranked = rankCandidates(deduped, {
      seedHost,
      eventYear: extractYear(args.eventName) ?? undefined,
    });

    ranked = await triageCandidates(ranked, args.eventName);

    const candidates = selectCandidates(ranked);
    const highSignal = candidates.filter(
      (c) => c.signalTier === "high" || c.signalTier === "medium",
    ).length;

    if (candidates.length > 0) {
      const recurringCount = candidates.filter((c) => c.recurring).length;
      await ctx.runMutation(internal.ingest.updateGatherProgress, {
        eventId: args.eventId,
        message: `Triage: ${highSignal} high-signal URLs · scraping ${candidates.length} (${recurringCount} past editions)…`,
        progress: 25,
      });
    }

    const SCRAPE_WAVE = 15;
    let saved = 0;
    let totalChars = 0;
    let cacheHits = 0;

    for (let i = 0; i < candidates.length; i += SCRAPE_WAVE) {
      const wave = candidates.slice(i, i + SCRAPE_WAVE);
      const waveEnd = Math.min(i + SCRAPE_WAVE, candidates.length);

      await ctx.runMutation(internal.ingest.updateGatherProgress, {
        eventId: args.eventId,
        message: `Gathering sources ${i + 1}–${waveEnd} of ${candidates.length}…`,
        progress: 25 + Math.round((i / Math.max(candidates.length, 1)) * 55),
      });

      const batch = await ctx.runAction(internal.scrapeCache.getOrScrapeBatch, {
        urls: wave.map((c) => c.url),
        categories: wave.map((c) => c.category),
      });
      cacheHits += batch.cacheHits;

      const pageByNorm = new Map(
        batch.pages.map((p) => [normalizeUrl(p.url), p]),
      );

      const toSave = wave
        .map((meta) => {
          const page = pageByNorm.get(normalizeUrl(meta.url));
          if (!page || page.scrapeStatus !== "ok" || page.markdown.length < 200) {
            return null;
          }
          return buildSourceRow(
            meta,
            page.markdown,
            page.scrapeStatus,
            page.scrapedPageId,
          );
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      if (toSave.length > 0) {
        const n = await ctx.runMutation(internal.ingest.addGatheredSourcesBatch, {
          eventId: args.eventId,
          sources: toSave,
        });
        saved += n;
        totalChars += toSave.reduce((sum, s) => sum + s.textContent.length, 0);
      }

      await ctx.runMutation(internal.ingest.updateGatherProgress, {
        eventId: args.eventId,
        message: `Gathered ${saved}/${candidates.length} sources${
          cacheHits > 0
            ? ` (${cacheHits} scrape cache hit${cacheHits === 1 ? "" : "s"}`
            : ""
        }${args.warmCache ? `${cacheHits > 0 ? " · " : " ("}Redis warm replay)` : cacheHits > 0 ? ")" : ""}`,
        progress: 25 + Math.round((waveEnd / Math.max(candidates.length, 1)) * 60),
      });
    }

    if (saved === 0) {
      const resolved = await resolveEventSourceTextCached(ctx, args.eventSource);
      await ctx.runMutation(internal.ingest.addGatheredSource, {
        eventId: args.eventId,
        textContent: resolved.text,
        kind: resolved.kind,
        url: resolved.url,
        title:
          resolved.kind === "snapshot"
            ? "Cached snapshot"
            : titleFromUrl(resolved.url ?? ""),
        category: resolved.kind === "snapshot" ? "other" : "event",
        scrapeStatus: resolved.text.length >= 200 ? "ok" : "empty",
        charCount: resolved.text.length,
        scrapedPageId: resolved.scrapedPageId,
      });
      saved = 1;
      totalChars = resolved.text.length;
    }

    const thin = totalChars < THIN_CORPUS_CHARS;
    await extractMetadata(ctx, args.eventId, args.eventName);

    await ctx.runMutation(internal.ingest.updateGatherProgress, {
      eventId: args.eventId,
      status: "completed",
      message: thin
        ? `Gathered ${saved} source${saved === 1 ? "" : "s"} — limited public data found${args.warmCache ? " (warm replay)" : ""}`
        : `Gathered ${saved} sources${args.warmCache ? " (warm replay)" : ""}`,
      progress: 100,
    });

    return { sourceCount: saved, thin };
  },
});

function buildSourceRow(
  meta: RankedCandidate,
  markdown: string,
  scrapeStatus: "ok" | "empty" | "failed",
  scrapedPageId: Id<"scrapedPage">,
) {
  return {
    textContent: markdown,
    kind: "url" as const,
    url: meta.url,
    title: meta.title ?? titleFromUrl(meta.url),
    category: meta.category,
    recurring: meta.recurring,
    editionLabel: meta.editionLabel,
    discoveryScore: meta.discoveryScore,
    signalTier: meta.signalTier,
    scrapeStatus,
    charCount: markdown.length,
    scrapedPageId,
  };
}

async function triageCandidates(
  ranked: RankedCandidate[],
  eventName: string,
): Promise<RankedCandidate[]> {
  const top = ranked.slice(0, TRIAGE_TOP_N);
  if (top.length === 0) return ranked;

  try {
    const payload = top.map((c, index) => ({
      index,
      url: c.url,
      title: c.title ?? "",
      category: c.category,
      recurring: c.recurring,
    }));

    const ai = await callOpenAiWebSearch<SourceTriageOutput>({
      instructions:
        "Classify each URL for a B2B event research pipeline. Rate signal strength for finding company names (sponsors, exhibitors, speakers). Mark registration/travel/hotel/about pages as skip. Return one row per input index.",
      input: `Event: ${eventName}\n\nURLs to triage (JSON):\n${JSON.stringify(payload)}`,
      responseSchema: sourceTriageSchema,
    });

    const triageByIndex = new Map(
      (ai?.urls ?? []).map((u) => [u.index, u]),
    );

    const updatedTop = top.map((c, index) => {
      const t = triageByIndex.get(index);
      if (!t) return c;
      return {
        ...c,
        signalTier:
          t.signal === "skip" ? c.signalTier : (t.signal as SignalTier),
        triageSkip: t.signal === "skip",
        category:
          t.expectedContent === "sponsor_list"
            ? "sponsors"
            : t.expectedContent === "exhibitor_list"
              ? "exhibitors"
              : t.expectedContent === "speaker_list"
                ? "speakers"
                : t.expectedContent === "agenda"
                  ? "program"
                  : c.category,
      };
    });

    return [...updatedTop, ...ranked.slice(TRIAGE_TOP_N)];
  } catch (err) {
    console.warn("URL triage failed, using keyword scores only", err);
    return ranked;
  }
}

async function discoverUrls(
  ctx: ActionCtx,
  eventName: string,
  eventSource: string,
): Promise<RawCandidate[]> {
  const seen = new Set<string>();
  const out: RawCandidate[] = [];
  const eventYear = extractYear(eventName) ?? new Date().getFullYear();
  const baseName = stripYear(eventName);
  const pastYears = [eventYear - 1, eventYear - 2, eventYear - 3];

  const add = (
    link: MappedLink,
    category: string,
    opts?: { recurring?: boolean; editionLabel?: string },
  ) => {
    if (!link.url) return;
    const norm = normalizeUrl(link.url);
    if (seen.has(norm)) return;
    seen.add(norm);

    const yr = extractYear(`${link.url} ${link.title ?? ""}`);
    const yearRecurring = yr != null && yr < eventYear;
    const recurring = Boolean(opts?.recurring) || yearRecurring;
    const editionLabel =
      opts?.editionLabel ??
      (yearRecurring ? `${baseName} ${yr}` : undefined);

    out.push({
      url: link.url,
      title: link.title,
      description: link.description,
      category,
      recurring,
      editionLabel,
    });
  };

  const seedTrim = eventSource.trim();
  const seedIsUrl = /^https?:\/\//i.test(seedTrim);

  if (seedIsUrl) {
    add({ url: seedTrim }, "event", { recurring: false });
  }

  const fc = hasFirecrawl();
  const currentQueries = [
    `${eventName} sponsors`,
    `${eventName} exhibitors`,
    `${eventName} exhibitor list`,
    `${eventName} sponsors and partners`,
    `${eventName} keynote speakers`,
    `${eventName} floor plan exhibitors`,
    `${eventName} "gold sponsor" OR "platinum sponsor"`,
    `${eventName} exhibitor list filetype:pdf`,
    `${eventName} site:luma.co OR site:partiful.com OR site:eventbrite.com`,
  ];
  const pastQueries = pastYears.flatMap((y) => [
    `${baseName} ${y} exhibitors`,
    `${baseName} ${y} sponsors`,
  ]);

  const [
    seedLinks,
    focusedSponsorLinks,
    focusedExhibitorLinks,
    focusedSpeakerLinks,
    currentHits,
    pastHits,
    searchScrapeHits,
    aiNow,
    aiPast,
  ] = await Promise.all([
    fc && seedIsUrl ? mapSite(seedTrim, { limit: 300 }) : Promise.resolve([]),
    fc && seedIsUrl
      ? mapSite(seedTrim, { search: "sponsor partner", limit: 60 })
      : Promise.resolve([]),
    fc && seedIsUrl
      ? mapSite(seedTrim, { search: "exhibitor booth", limit: 80 })
      : Promise.resolve([]),
    fc && seedIsUrl
      ? mapSite(seedTrim, { search: "speaker keynote program", limit: 50 })
      : Promise.resolve([]),
    fc
      ? Promise.all(currentQueries.map((q) => searchUrls(q, 4))).then((r) =>
          r.flat(),
        )
      : Promise.resolve([]),
    fc
      ? Promise.all(pastQueries.map((q) => searchUrls(q, 3))).then((r) =>
          r.flat(),
        )
      : Promise.resolve([]),
    fc
      ? Promise.all([
          searchEventSource(`${eventName} sponsors exhibitors`),
          searchEventSource(`${eventName} "gold sponsor" OR "platinum sponsor"`),
          searchEventSource(`${eventName} keynote speakers list`),
        ])
      : Promise.resolve([]),
    callOpenAiWebSearch<SourceDiscoveryOutput>({
      instructions:
        "Use web search to find public pages that name companies or organizations participating in THIS year's event (sponsor lists, exhibitor lists, partner announcements, press releases, program/speaker pages). Return real URLs only — never invent a URL.",
      input: `Event: ${eventName}\nFind up to 10 pages that list sponsors, exhibitors, partners, or speakers for this event.`,
      responseSchema: sourceDiscoverySchema,
    }),
    callOpenAiWebSearch<SourceDiscoveryOutput>({
      instructions:
        "Use web search to find sponsor/exhibitor/partner lists from PAST editions of this recurring event (previous years). These reveal companies likely to return. Return real URLs only — never invent a URL.",
      input: `Event series: ${baseName}\nFind up to 10 pages listing exhibitors or sponsors from past editions (e.g. ${pastYears.join(", ")}).`,
      responseSchema: sourceDiscoverySchema,
    }),
  ]);

  // Seed scrapedPage cache from search-and-scrape hits (avoid double scrape in gather).
  const searchPages = searchScrapeHits.flatMap((h) => {
    if (!h?.url || !h.markdown || h.markdown.length < 200) return [];
    const markdown = h.markdown;
    return [
      {
        url: h.url,
        markdown: markdown.slice(0, 50_000),
        category: categorize(h.url, h.title ?? ""),
        scrapeStatus: scrapeStatusFromMarkdown(markdown),
      },
    ];
  });

  if (searchPages.length > 0) {
    await ctx.runMutation(internal.scrapeCache.upsertBatch, {
      pages: searchPages,
    });
  }

  for (const l of rankLinks(seedLinks).slice(0, 16)) {
    add(l, categorize(l.url, l.title ?? ""));
  }
  for (const l of rankLinks(focusedSponsorLinks).slice(0, 20)) {
    add(l, "sponsors");
  }
  for (const l of rankLinks(focusedExhibitorLinks).slice(0, 24)) {
    add(l, "exhibitors");
  }
  for (const l of rankLinks(focusedSpeakerLinks).slice(0, 16)) {
    add(l, "speakers");
  }
  for (const h of currentHits) add(h, categorize(h.url, h.title ?? ""));
  for (const h of pastHits) {
    add(h, "past_edition", { recurring: true });
  }
  for (const hit of searchScrapeHits) {
    if (hit?.url) {
      add(
        { url: hit.url, title: hit.title },
        categorize(hit.url, hit.title ?? ""),
      );
    }
  }
  for (const u of aiNow?.urls ?? []) {
    if (u.url) add({ url: u.url, title: u.title }, u.category ?? "news");
  }
  for (const u of aiPast?.urls ?? []) {
    if (u.url)
      add({ url: u.url, title: u.title }, "past_edition", { recurring: true });
  }

  if (fc) {
    const seedHost = seedIsUrl ? hostOf(seedTrim) : "";
    const pastHosts = Array.from(
      new Set(
        out
          .filter((c) => c.recurring && c.url)
          .map((c) => hostOf(c.url))
          .filter((h) => h && h !== seedHost),
      ),
    ).slice(0, 3);

    const mapped = await Promise.all(
      pastHosts.map((h) => mapSite(`https://${h}`, { limit: 120 })),
    );
    for (const links of mapped) {
      for (const l of rankLinks(links).slice(0, 6)) {
        add(l, categorize(l.url, l.title ?? ""), { recurring: true });
      }
    }
  }

  return out;
}

function extractYear(text: string): number | null {
  const matches = text.match(/\b(20\d{2})\b/g);
  if (!matches) return null;
  const years = matches
    .map((m) => Number(m))
    .filter((y) => y >= 2000 && y <= new Date().getFullYear() + 1);
  return years.length ? Math.max(...years) : null;
}

function stripYear(eventName: string): string {
  return eventName.replace(/\b20\d{2}\b/g, "").replace(/\s{2,}/g, " ").trim();
}

async function extractMetadata(
  ctx: ActionCtx,
  eventId: Id<"event">,
  eventName: string,
): Promise<void> {
  try {
    const docs = await ctx.runQuery(
      internal.ingest.listSourcesForExtraction,
      { eventId },
    );
    const corpus = docs
      .map((d) => d.textContent)
      .join("\n\n")
      .slice(0, 12_000);
    if (corpus.length < 200) return;

    const meta = await callOpenAiJson<EventMetaOutput>({
      system:
        "Extract the event's real location and dates from the source text. Use empty strings for anything not present. Never guess.",
      user: `Event name: ${eventName}\n\nSource text:\n${corpus}`,
      responseSchema: eventMetaSchema,
    });
    if (!meta) return;

    await ctx.runMutation(internal.events.patchResearched, {
      eventId,
      location: meta.location?.trim() || undefined,
      startDate: isoOrUndefined(meta.startDate),
      endDate: isoOrUndefined(meta.endDate),
    });
  } catch (err) {
    console.warn("Metadata extraction failed", err);
  }
}

function isoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function titleFromUrl(url: string): string {
  if (!url) return "Source";
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const last = path[path.length - 1];
    const host = u.hostname.replace(/^www\./, "");
    if (!last) return host;
    const pretty = last.replace(/[-_]/g, " ").replace(/\.[a-z]+$/i, "");
    return `${host} — ${pretty}`;
  } catch {
    return url.slice(0, 60);
  }
}
