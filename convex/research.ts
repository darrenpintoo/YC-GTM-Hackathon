import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  batchScrape,
  hasFirecrawl,
  mapSite,
  searchUrls,
  type MappedLink,
} from "./lib/firecrawl";
import { resolveEventSourceText } from "./lib/fetchSource";
import { callOpenAiJson, callOpenAiWebSearch } from "./lib/openai";
import {
  eventMetaSchema,
  sourceDiscoverySchema,
  type EventMetaOutput,
  type SourceDiscoveryOutput,
} from "../lib/aiSchemas";

const MAX_SOURCES = 50;
const MAX_RECURRING_SHARE = 0.4; // keep current-year sources dominant
const THIN_CORPUS_CHARS = 1500;

// Keywords that signal a page likely names companies/people at the event.
const RELEVANCE_KEYWORDS = [
  "sponsor",
  "exhibit",
  "partner",
  "supporter",
  "program",
  "speaker",
  "keynote",
  "plenary",
  "organizer",
  "organiser",
  "committee",
  "attend",
  "participant",
  "floorplan",
  "floor-plan",
];

type Candidate = MappedLink & {
  category: string;
  recurring: boolean;
  editionLabel?: string;
};

type GatherResult = {
  sourceCount: number;
  thin: boolean;
};

/**
 * Deep-research gathering phase. Discovers many candidate pages (site map +
 * web search), scrapes the most relevant ones, persists each as a source
 * document, and extracts the real event metadata. Streams progress on the
 * "ingest" (Gather sources) job. Always leaves at least one source so the rest
 * of the pipeline can proceed.
 */
export const gather = internalAction({
  args: {
    eventId: v.id("event"),
    eventName: v.string(),
    eventSource: v.string(),
  },
  returns: v.object({ sourceCount: v.number(), thin: v.boolean() }),
  handler: async (ctx, args): Promise<GatherResult> => {
    await ctx.runMutation(internal.ingest.clearSources, {
      eventId: args.eventId,
    });
    await ctx.runMutation(internal.ingest.updateGatherProgress, {
      eventId: args.eventId,
      message: "Discovering sources across the web…",
      progress: 8,
    });

    const discovered = await discoverUrls(args.eventName, args.eventSource);
    const candidates = selectCandidates(discovered);

    if (candidates.length > 0) {
      const recurringCount = candidates.filter((c) => c.recurring).length;
      await ctx.runMutation(internal.ingest.updateGatherProgress, {
        eventId: args.eventId,
        message: `Found ${discovered.length} pages (${recurringCount} from past editions) · scraping ${candidates.length}…`,
        progress: 25,
      });
    }

    const urls = candidates.map((c) => c.url);
    const metaByUrl = new Map(
      candidates.map((c) => [normalizeUrl(c.url), c]),
    );

    // Scrape + persist in waves so Firecrawl runs in parallel per wave and the
    // UI gets progress during the long scrape (not one silent block at the end).
    const SCRAPE_WAVE = 15;
    let saved = 0;
    let totalChars = 0;
    for (let i = 0; i < urls.length; i += SCRAPE_WAVE) {
      const waveUrls = urls.slice(i, i + SCRAPE_WAVE);
      const waveEnd = Math.min(i + SCRAPE_WAVE, urls.length);
      await ctx.runMutation(internal.ingest.updateGatherProgress, {
        eventId: args.eventId,
        message: `Scraping sources ${i + 1}–${waveEnd} of ${urls.length}…`,
        progress: 25 + Math.round((i / Math.max(urls.length, 1)) * 55),
      });

      const docs = waveUrls.length > 0 ? await batchScrape(waveUrls) : [];
      const toSave = docs.map((doc) => {
        const meta = metaByUrl.get(normalizeUrl(doc.url));
        return {
          textContent: doc.markdown,
          kind: "url" as const,
          url: doc.url,
          title: titleFromUrl(doc.url),
          category: meta?.category ?? categorize(doc.url, doc.markdown),
          recurring: meta?.recurring ?? false,
          editionLabel: meta?.editionLabel,
        };
      });

      if (toSave.length > 0) {
        const n = await ctx.runMutation(internal.ingest.addGatheredSourcesBatch, {
          eventId: args.eventId,
          sources: toSave,
        });
        saved += n;
        totalChars += toSave.reduce((sum, s) => sum + s.textContent.length, 0);
        await ctx.runMutation(internal.ingest.updateGatherProgress, {
          eventId: args.eventId,
          message: `Gathered ${saved}/${urls.length} sources`,
          progress: 25 + Math.round((waveEnd / Math.max(urls.length, 1)) * 60),
        });
      }
    }

    // Fallback: nothing usable gathered — resolve the raw source (or snapshot).
    if (saved === 0) {
      const resolved = await resolveEventSourceText(args.eventSource);
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
      });
      saved = 1;
      totalChars = resolved.text.length;
    }

    const thin = totalChars < THIN_CORPUS_CHARS;

    // Pull real event metadata (dates/location) from the gathered corpus.
    await extractMetadata(ctx, args.eventId, args.eventName);

    await ctx.runMutation(internal.ingest.updateGatherProgress, {
      eventId: args.eventId,
      status: "completed",
      message: thin
        ? `Gathered ${saved} source${saved === 1 ? "" : "s"} — limited public data found`
        : `Gathered ${saved} sources`,
      progress: 100,
    });

    return { sourceCount: saved, thin };
  },
});

async function discoverUrls(
  eventName: string,
  eventSource: string,
): Promise<Candidate[]> {
  const seen = new Set<string>();
  const out: Candidate[] = [];
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

    // Classify recurring by explicit flag or a past-year token in url/title.
    const yr = extractYear(`${link.url} ${link.title ?? ""}`);
    const yearRecurring = yr != null && yr < eventYear;
    const recurring = Boolean(opts?.recurring) || yearRecurring;
    const editionLabel =
      opts?.editionLabel ??
      (yearRecurring ? `${baseName} ${yr}` : undefined);

    out.push({ ...link, category, recurring, editionLabel });
  };

  const seedTrim = eventSource.trim();
  const seedIsUrl = /^https?:\/\//i.test(seedTrim);

  // 1. Seed URL first (always scrape what the user explicitly gave us).
  if (seedIsUrl) {
    add({ url: seedTrim }, "event", { recurring: false });
  }

  // 2. Run all discovery in parallel.
  const fc = hasFirecrawl();
  const currentQueries = [
    `${eventName} sponsors`,
    `${eventName} exhibitors`,
    `${eventName} exhibitor list`,
    `${eventName} sponsors and partners`,
    `${eventName} keynote speakers`,
    `${eventName} floor plan exhibitors`,
  ];
  const pastQueries = pastYears.flatMap((y) => [
    `${baseName} ${y} exhibitors`,
    `${baseName} ${y} sponsors`,
  ]);

  const [
    seedLinks,
    currentHits,
    pastHits,
    aiNow,
    aiPast,
  ] = await Promise.all([
    fc && seedIsUrl ? mapSite(seedTrim, { limit: 300 }) : Promise.resolve([]),
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

  // 2a. Seed-site map links (current edition).
  for (const l of rankLinks(seedLinks).slice(0, 16)) {
    add(l, categorize(l.url, l.title ?? ""));
  }
  // 2b. Current-edition search hits.
  for (const h of currentHits) add(h, categorize(h.url, h.title ?? ""));
  // 2c. Past-edition search hits (explicitly recurring).
  for (const h of pastHits) {
    add(h, "past_edition", { recurring: true });
  }
  // 2d. OpenAI current + past.
  for (const u of aiNow?.urls ?? []) {
    if (u.url) add({ url: u.url, title: u.title }, u.category ?? "news");
  }
  for (const u of aiPast?.urls ?? []) {
    if (u.url)
      add({ url: u.url, title: u.title }, "past_edition", { recurring: true });
  }

  // 3. Second pass: map discovered past-edition root domains (parallel).
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

/**
 * Cap the candidate set at MAX_SOURCES, keeping current-year sources dominant
 * (recurring limited to MAX_RECURRING_SHARE). Confirmed first, then recurring.
 */
function selectCandidates(candidates: Candidate[]): Candidate[] {
  const confirmed = candidates.filter((c) => !c.recurring);
  const recurring = candidates.filter((c) => c.recurring);

  const maxRecurring = Math.floor(MAX_SOURCES * MAX_RECURRING_SHARE);
  const recurringTake = recurring.slice(0, maxRecurring);
  const confirmedTake = confirmed.slice(0, MAX_SOURCES - recurringTake.length);

  return [...confirmedTake, ...recurringTake];
}

function extractYear(text: string): number | null {
  const matches = text.match(/\b(20\d{2})\b/g);
  if (!matches) return null;
  // Prefer the most recent plausible year mentioned.
  const years = matches
    .map((m) => Number(m))
    .filter((y) => y >= 2000 && y <= new Date().getFullYear() + 1);
  return years.length ? Math.max(...years) : null;
}

function stripYear(eventName: string): string {
  return eventName.replace(/\b20\d{2}\b/g, "").replace(/\s{2,}/g, " ").trim();
}

function rankLinks(links: MappedLink[]): MappedLink[] {
  return links
    .map((l) => ({ link: l, score: relevanceScore(l) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.link);
}

function relevanceScore(link: MappedLink): number {
  const hay = `${link.url} ${link.title ?? ""} ${link.description ?? ""}`.toLowerCase();
  let score = 0;
  for (const kw of RELEVANCE_KEYWORDS) {
    if (hay.includes(kw)) score += 1;
  }
  return score;
}

function categorize(url: string, hint: string): string {
  const hay = `${url} ${hint}`.toLowerCase();
  if (hay.includes("sponsor") || hay.includes("supporter")) return "sponsors";
  if (hay.includes("exhibit")) return "exhibitors";
  if (
    hay.includes("speaker") ||
    hay.includes("keynote") ||
    hay.includes("plenary")
  )
    return "speakers";
  if (
    hay.includes("program") ||
    hay.includes("agenda") ||
    hay.includes("schedule")
  )
    return "program";
  if (
    hay.includes("news") ||
    hay.includes("press") ||
    hay.includes("blog") ||
    hay.includes("announce")
  )
    return "news";
  return "event";
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

function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
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
