import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { extractCompaniesHeuristic } from "./lib/extractHeuristic";
import { upsertJob } from "./lib/jobs";
import { normalizeCompanyName } from "./lib/normalize";

const EVENT_ROLES = ["exhibitor", "sponsor", "speaker", "unknown"] as const;
type EventRole = (typeof EVENT_ROLES)[number];
function coerceRole(role: string): EventRole {
  return (EVENT_ROLES as readonly string[]).includes(role)
    ? (role as EventRole)
    : "unknown";
}

function normalizeContactField(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "unknown") return undefined;
  return trimmed;
}

const FACT_TYPES = [
  "exhibitor_list",
  "sponsor_list",
  "speaker_list",
  "agenda",
  "booth_map",
  "other",
  "unknown",
] as const;
type FactType = (typeof FACT_TYPES)[number];
function coerceFactType(factType: string): FactType {
  return (FACT_TYPES as readonly string[]).includes(factType)
    ? (factType as FactType)
    : "other";
}

function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `fnv1a:${hash.toString(16)}`;
}

export const ingestSource = mutation({
  args: {
    eventId: v.id("event"),
    textContent: v.string(),
    kind: v.union(
      v.literal("url"),
      v.literal("paste"),
      v.literal("pdf"),
      v.literal("snapshot"),
    ),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  returns: v.id("sourceDocument"),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "ingest", {
      status: "running",
      message: "Storing source document",
      progress: 20,
    });

    const sourceDocumentId = await ctx.db.insert("sourceDocument", {
      eventId: args.eventId,
      kind: args.kind,
      url: args.url,
      title: args.title,
      textContent: args.textContent,
      contentHash: hashContent(args.textContent),
      fetchedAt: Date.now(),
    });

    await upsertJob(ctx, args.eventId, "ingest", {
      status: "completed",
      message: "Source document stored",
      progress: 100,
    });

    return sourceDocumentId;
  },
});

/** Mark the ingest step running (shown while the source is being scraped). */
export const startIngest = internalMutation({
  args: { eventId: v.id("event"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "ingest", {
      status: "running",
      message: args.message,
      progress: 15,
    });
    return null;
  },
});

/** Persist already-resolved source text (from the streaming pipeline). */
export const ingestResolved = internalMutation({
  args: {
    eventId: v.id("event"),
    textContent: v.string(),
    kind: v.union(
      v.literal("url"),
      v.literal("paste"),
      v.literal("pdf"),
      v.literal("snapshot"),
    ),
    url: v.optional(v.string()),
  },
  returns: v.id("sourceDocument"),
  handler: async (ctx, args) => {
    const sourceDocumentId = await ctx.db.insert("sourceDocument", {
      eventId: args.eventId,
      kind: args.kind,
      url: args.url,
      title: undefined,
      textContent: args.textContent,
      contentHash: hashContent(args.textContent),
      fetchedAt: Date.now(),
    });

    const message =
      args.kind === "url"
        ? `Scraped ${args.url ? hostOf(args.url) : "live source"}`
        : args.kind === "snapshot"
          ? "Live fetch blocked — using cached snapshot"
          : "Source captured";

    await upsertJob(ctx, args.eventId, "ingest", {
      status: "completed",
      message,
      progress: 100,
    });

    return sourceDocumentId;
  },
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "live source";
  }
}

/** Stream a progress message on the ingest ("Gather sources") job. */
export const updateGatherProgress = internalMutation({
  args: {
    eventId: v.id("event"),
    message: v.string(),
    progress: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("skipped"),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "ingest", {
      status: args.status ?? "running",
      message: args.message,
      progress: args.progress,
    });
    return null;
  },
});

/** Insert one gathered research page as a source document (no job side effects). */
export const addGatheredSource = internalMutation({
  args: {
    eventId: v.id("event"),
    textContent: v.string(),
    kind: v.union(
      v.literal("url"),
      v.literal("paste"),
      v.literal("snapshot"),
    ),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
    editionLabel: v.optional(v.string()),
  },
  returns: v.id("sourceDocument"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("sourceDocument", {
      eventId: args.eventId,
      kind: args.kind,
      url: args.url,
      title: args.title,
      category: args.category,
      recurring: args.recurring,
      editionLabel: args.editionLabel,
      textContent: args.textContent,
      contentHash: hashContent(args.textContent),
      fetchedAt: Date.now(),
    });
  },
});

/** Insert many gathered pages in one mutation (much faster than N× addGatheredSource). */
export const addGatheredSourcesBatch = internalMutation({
  args: {
    eventId: v.id("event"),
    sources: v.array(
      v.object({
        textContent: v.string(),
        kind: v.union(
          v.literal("url"),
          v.literal("paste"),
          v.literal("snapshot"),
        ),
        url: v.optional(v.string()),
        title: v.optional(v.string()),
        category: v.optional(v.string()),
        recurring: v.optional(v.boolean()),
        editionLabel: v.optional(v.string()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    for (const src of args.sources) {
      await ctx.db.insert("sourceDocument", {
        eventId: args.eventId,
        kind: src.kind,
        url: src.url,
        title: src.title,
        category: src.category,
        recurring: src.recurring,
        editionLabel: src.editionLabel,
        textContent: src.textContent,
        contentHash: hashContent(src.textContent),
        fetchedAt: now,
      });
      inserted += 1;
    }
    return inserted;
  },
});

/** Remove all source documents for an event (clean slate on re-run). */
export const clearSources = internalMutation({
  args: { eventId: v.id("event") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("sourceDocument")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const doc of docs) {
      await ctx.db.delete("sourceDocument", doc._id);
    }
    return null;
  },
});

/** List source docs (id + text + category) for multi-doc extraction. */
export const listSourcesForExtraction = internalQuery({
  args: { eventId: v.id("event") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("sourceDocument")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return docs.map((d) => ({
      _id: d._id,
      url: d.url ?? null,
      title: d.title ?? null,
      category: d.category ?? null,
      recurring: d.recurring ?? false,
      editionLabel: d.editionLabel ?? null,
      textContent: d.textContent,
    }));
  },
});

/** Mark the extract step running (optionally with streamed progress). */
export const markExtractRunning = internalMutation({
  args: {
    eventId: v.id("event"),
    message: v.optional(v.string()),
    progress: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "extract", {
      status: "running",
      message: args.message ?? "Extracting companies across sources…",
      progress: args.progress ?? 10,
    });
    return null;
  },
});

/** Heuristic fallback across ALL gathered sources (no AI). */
export const extractAllHeuristic = internalMutation({
  args: { eventId: v.id("event") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("sourceDocument")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const existing = await ctx.db
      .query("eventCompany")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete("eventCompany", row._id);
    }

    const now = Date.now();
    const seen = new Set<string>();
    let inserted = 0;
    for (const doc of docs) {
      const companies = extractCompaniesHeuristic(doc.textContent);
      for (const company of companies) {
        const key = normalizeCompanyName(company.companyName);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        await ctx.db.insert("eventCompany", {
          eventId: args.eventId,
          sourceDocumentId: doc._id,
          companyName: company.companyName,
          normalizedName: key,
          role: company.role,
          boothOrSession:
            company.boothOrSession === "unknown"
              ? undefined
              : company.boothOrSession,
          quote: company.quote,
          confidence: company.confidence,
          presence: doc.recurring ? "recurring" : "confirmed",
          editionLabel: doc.editionLabel,
          createdAt: now,
        });
        inserted += 1;
      }
    }

    await upsertJob(ctx, args.eventId, "extract", {
      status: "completed",
      message: `${inserted} companies extracted (heuristic)`,
      progress: 100,
    });

    return inserted;
  },
});

export const extractFromSource = internalMutation({
  args: {
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "extract", {
      status: "running",
      message: "Extracting companies from source",
      progress: 10,
    });

    const source = await ctx.db.get("sourceDocument", args.sourceDocumentId);
    if (!source) {
      throw new Error("Source document not found");
    }

    const companies = extractCompaniesHeuristic(source.textContent);
    const now = Date.now();

    const existingCompanies = await ctx.db
      .query("eventCompany")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of existingCompanies) {
      await ctx.db.delete("eventCompany", row._id);
    }

    for (const company of companies) {
      await ctx.db.insert("eventCompany", {
        eventId: args.eventId,
        sourceDocumentId: args.sourceDocumentId,
        companyName: company.companyName,
        normalizedName: normalizeCompanyName(company.companyName),
        role: company.role,
        boothOrSession:
          company.boothOrSession === "unknown" ? undefined : company.boothOrSession,
        quote: company.quote,
        confidence: company.confidence,
        createdAt: now,
      });
    }

    await ctx.db.insert("eventFact", {
      eventId: args.eventId,
      sourceDocumentId: args.sourceDocumentId,
      factType: "exhibitor_list",
      label: "Companies extracted",
      value: `${companies.length} companies parsed from source`,
      quote: source.textContent.slice(0, 240),
      confidence: companies.length > 0 ? 0.9 : 0.3,
      createdAt: now,
    });

    await upsertJob(ctx, args.eventId, "extract", {
      status: "completed",
      message: `${companies.length} companies extracted`,
      progress: 100,
    });

    return companies.length;
  },
});

/** Read a single source document's text (used by the AI extraction action). */
export const getSource = internalQuery({
  args: { sourceDocumentId: v.id("sourceDocument") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get("sourceDocument", args.sourceDocumentId);
    if (!source) return null;
    return {
      textContent: source.textContent,
      url: source.url ?? null,
    };
  },
});

/**
 * Persist AI-extracted companies + facts gathered across MANY source documents.
 * Each company/fact carries its own sourceDocumentId so citations point to the
 * exact page. Companies are deduped by normalized name (highest confidence wins).
 */
export const applyExtraction = internalMutation({
  args: {
    eventId: v.id("event"),
    companies: v.array(
      v.object({
        sourceDocumentId: v.id("sourceDocument"),
        companyName: v.string(),
        role: v.string(),
        boothOrSession: v.string(),
        quote: v.string(),
        confidence: v.number(),
        presence: v.optional(
          v.union(v.literal("confirmed"), v.literal("recurring")),
        ),
        editionLabel: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactTitle: v.optional(v.string()),
        contactQuote: v.optional(v.string()),
      }),
    ),
    facts: v.array(
      v.object({
        sourceDocumentId: v.id("sourceDocument"),
        factType: v.string(),
        label: v.string(),
        value: v.string(),
        quote: v.string(),
        confidence: v.number(),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();

    const existingCompanies = await ctx.db
      .query("eventCompany")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of existingCompanies) {
      await ctx.db.delete("eventCompany", row._id);
    }

    // Dedupe by normalized name. Prefer a "confirmed" mention over "recurring",
    // then the highest-confidence one.
    const best = new Map<string, (typeof args.companies)[number]>();
    const rank = (c: (typeof args.companies)[number]) => {
      let score = (c.presence === "recurring" ? 0 : 1) * 10 + c.confidence;
      if (normalizeContactField(c.contactName)) score += 0.5;
      return score;
    };
    for (const company of args.companies) {
      if (!company.companyName.trim()) continue;
      const key = normalizeCompanyName(company.companyName);
      if (!key) continue;
      const prior = best.get(key);
      if (!prior || rank(company) > rank(prior)) {
        best.set(key, company);
      }
    }

    let inserted = 0;
    for (const [key, company] of best) {
      await ctx.db.insert("eventCompany", {
        eventId: args.eventId,
        sourceDocumentId: company.sourceDocumentId,
        companyName: company.companyName,
        normalizedName: key,
        role: coerceRole(company.role),
        boothOrSession:
          !company.boothOrSession || company.boothOrSession === "unknown"
            ? undefined
            : company.boothOrSession,
        quote: company.quote,
        confidence: company.confidence,
        presence: company.presence ?? "confirmed",
        editionLabel: company.editionLabel,
        contactName: normalizeContactField(company.contactName),
        contactTitle: normalizeContactField(company.contactTitle),
        contactQuote: normalizeContactField(company.contactQuote),
        createdAt: now,
      });
      inserted += 1;
    }

    for (const fact of args.facts) {
      await ctx.db.insert("eventFact", {
        eventId: args.eventId,
        sourceDocumentId: fact.sourceDocumentId,
        factType: coerceFactType(fact.factType),
        label: fact.label,
        value: fact.value,
        quote: fact.quote,
        confidence: fact.confidence,
        createdAt: now,
      });
    }

    await upsertJob(ctx, args.eventId, "extract", {
      status: "completed",
      message: `${inserted} companies extracted across sources`,
      progress: 100,
    });

    return inserted;
  },
});

export const listSourceDocuments = query({
  args: { eventId: v.id("event") },
  returns: v.array(
    v.object({
      _id: v.id("sourceDocument"),
      _creationTime: v.number(),
      eventId: v.id("event"),
      kind: v.union(
        v.literal("url"),
        v.literal("paste"),
        v.literal("pdf"),
        v.literal("snapshot"),
      ),
      url: v.optional(v.string()),
      title: v.optional(v.string()),
      category: v.optional(v.string()),
      recurring: v.optional(v.boolean()),
      editionLabel: v.optional(v.string()),
      textContent: v.string(),
      contentHash: v.string(),
      fetchedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceDocument")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const listEventCompanies = query({
  args: { eventId: v.id("event") },
  returns: v.array(
    v.object({
      _id: v.id("eventCompany"),
      _creationTime: v.number(),
      eventId: v.id("event"),
      sourceDocumentId: v.id("sourceDocument"),
      companyName: v.string(),
      normalizedName: v.optional(v.string()),
      domain: v.optional(v.string()),
      role: v.union(
        v.literal("exhibitor"),
        v.literal("sponsor"),
        v.literal("speaker"),
        v.literal("unknown"),
      ),
      boothOrSession: v.optional(v.string()),
      quote: v.string(),
      confidence: v.number(),
      presence: v.optional(
        v.union(v.literal("confirmed"), v.literal("recurring")),
      ),
      editionLabel: v.optional(v.string()),
      contactName: v.optional(v.string()),
      contactTitle: v.optional(v.string()),
      contactQuote: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("eventCompany")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});
