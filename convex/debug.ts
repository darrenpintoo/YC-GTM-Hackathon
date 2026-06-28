import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  eventCompanyRoleValidator,
  evidenceValidator,
  matchTierValidator,
  recommendationValidator,
  underwritingAssumptionsValidator,
} from "./lib/validators";
import { DEMO_EVENT, SKIP_EVENT } from "./lib/demoSeed";

const scoreValidator = v.union(
  v.object({
    _id: v.id("eventScore"),
    recommendation: recommendationValidator,
    totalEventCost: v.number(),
    revenuePerQualifiedMeeting: v.number(),
    requiredQualifiedMeetings: v.number(),
    sponsorCap: v.number(),
    matchedPipelineValue: v.number(),
    tier1MatchCount: v.number(),
    tier2MatchCount: v.number(),
    subScores: v.object({
      pipelinePresence: v.number(),
      evidenceQuality: v.number(),
      costEfficiency: v.number(),
      icpDensity: v.number(),
    }),
    assumptions: underwritingAssumptionsValidator,
    rationale: v.array(v.string()),
    createdAt: v.number(),
  }),
  v.null(),
);

const memoValidator = v.union(
  v.object({
    _id: v.id("decisionMemo"),
    headline: v.string(),
    verdict: recommendationValidator,
    sections: v.array(
      v.object({
        title: v.string(),
        body: v.string(),
        citations: v.array(evidenceValidator),
      }),
    ),
    missingEvidence: v.array(v.string()),
    createdAt: v.number(),
  }),
  v.null(),
);

const dumpValidator = v.object({
  event: v.object({
    _id: v.id("event"),
    name: v.string(),
    slug: v.string(),
    sponsorQuote: v.optional(v.number()),
  }),
  sourceDocuments: v.array(
    v.object({
      _id: v.id("sourceDocument"),
      title: v.optional(v.string()),
      url: v.optional(v.string()),
      contentHash: v.string(),
      fetchedAt: v.number(),
    }),
  ),
  matches: v.array(
    v.object({
      rank: v.optional(v.number()),
      tier: matchTierValidator,
      companyName: v.string(),
      domain: v.optional(v.string()),
      role: eventCompanyRoleValidator,
      boothOrSession: v.optional(v.string()),
      fitScore: v.number(),
      confidence: v.number(),
      matchedOppValue: v.optional(v.number()),
      evidenceQuote: v.string(),
      evidenceUrl: v.string(),
    }),
  ),
  eventScore: scoreValidator,
  decisionMemo: memoValidator,
});

export const dumpEvent = query({
  args: { eventId: v.id("event") },
  returns: dumpValidator,
  handler: async (ctx, args) => {
    return await buildDump(ctx, args.eventId);
  },
});

export const dumpBySlug = query({
  args: { slug: v.string() },
  returns: dumpValidator,
  handler: async (ctx, args) => {
    return await buildDumpBySlug(ctx, args.slug);
  },
});

export const dumpDemo = query({
  args: {},
  returns: dumpValidator,
  handler: async (ctx) => {
    return await buildDumpBySlug(ctx, DEMO_EVENT.slug);
  },
});

export const dumpSkipDemo = query({
  args: {},
  returns: dumpValidator,
  handler: async (ctx) => {
    return await buildDumpBySlug(ctx, SKIP_EVENT.slug);
  },
});

async function buildDumpBySlug(ctx: QueryCtx, slug: string) {
  const event = await ctx.db
    .query("event")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!event) {
    throw new Error(`Event not found for slug: ${slug}`);
  }

  return await buildDump(ctx, event._id);
}

async function buildDump(
  ctx: QueryCtx,
  eventId: Id<"event">,
) {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found");
  }

  const sourceDocuments = await ctx.db
    .query("sourceDocument")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const matches = await ctx.db
    .query("accountMatch")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const eventScore = await ctx.db
    .query("eventScore")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .order("desc")
    .first();
  const decisionMemo = await ctx.db
    .query("decisionMemo")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .order("desc")
    .first();

  return {
    event: {
      _id: event._id,
      name: event.name,
      slug: event.slug,
      sponsorQuote: event.sponsorQuote,
    },
    sourceDocuments: sourceDocuments.map((source) => ({
      _id: source._id,
      title: source.title,
      url: source.url,
      contentHash: source.contentHash,
      fetchedAt: source.fetchedAt,
    })),
    matches: matches
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .map((match) => {
        const evidence = match.evidence[0];
        return {
          rank: match.rank,
          tier: match.tier,
          companyName: match.companyName,
          domain: match.domain,
          role: match.role,
          boothOrSession: match.boothOrSession,
          fitScore: match.fitScore,
          confidence: match.confidence,
          matchedOppValue: match.matchedOppValue,
          evidenceQuote: evidence?.quote ?? "",
          evidenceUrl: evidence?.sourceUrl ?? "",
        };
      }),
    eventScore: eventScore ? scoreDump(eventScore) : null,
    decisionMemo: decisionMemo ? memoDump(decisionMemo) : null,
  };
}

function scoreDump(score: Doc<"eventScore">) {
  return {
    _id: score._id,
    recommendation: score.recommendation,
    totalEventCost: score.totalEventCost,
    revenuePerQualifiedMeeting: score.revenuePerQualifiedMeeting,
    requiredQualifiedMeetings: score.requiredQualifiedMeetings,
    sponsorCap: score.sponsorCap,
    matchedPipelineValue: score.matchedPipelineValue,
    tier1MatchCount: score.tier1MatchCount,
    tier2MatchCount: score.tier2MatchCount,
    subScores: score.subScores,
    assumptions: score.assumptions,
    rationale: score.rationale,
    createdAt: score.createdAt,
  };
}

function memoDump(memo: Doc<"decisionMemo">) {
  return {
    _id: memo._id,
    headline: memo.headline,
    verdict: memo.verdict,
    sections: memo.sections,
    missingEvidence: memo.missingEvidence,
    createdAt: memo.createdAt,
  };
}
