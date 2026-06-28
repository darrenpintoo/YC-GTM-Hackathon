import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { extractCompaniesHeuristic } from "./lib/extractHeuristic";
import { upsertJob } from "./lib/jobs";
import { normalizeCompanyName } from "./lib/normalize";

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
