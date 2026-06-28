import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Contract queries for Darren — reactive reads against Convex tables.
 * During W0, UI can also import lib/mocks.ts directly for mock-data mode.
 */

export const listJobsByEvent = query({
  args: { eventId: v.id("event") },
  returns: v.array(
    v.object({
      _id: v.id("jobs"),
      _creationTime: v.number(),
      eventId: v.id("event"),
      step: v.union(
        v.literal("ingest"),
        v.literal("extract"),
        v.literal("match"),
        v.literal("score"),
        v.literal("memo"),
        v.literal("enrich"),
        v.literal("outreach"),
      ),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("skipped"),
      ),
      message: v.optional(v.string()),
      progress: v.optional(v.number()),
      error: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const listAccountMatchesByEvent = query({
  args: { eventId: v.id("event") },
  returns: v.array(
    v.object({
      _id: v.id("accountMatch"),
      _creationTime: v.number(),
      eventId: v.id("event"),
      tier: v.union(v.literal("tier1_crm"), v.literal("tier2_icp")),
      crmAccountId: v.optional(v.id("crmAccount")),
      companyName: v.string(),
      domain: v.optional(v.string()),
      role: v.union(
        v.literal("exhibitor"),
        v.literal("sponsor"),
        v.literal("speaker"),
        v.literal("unknown"),
      ),
      boothOrSession: v.optional(v.string()),
      fitScore: v.number(),
      confidence: v.number(),
      evidence: v.array(
        v.object({
          sourceDocumentId: v.id("sourceDocument"),
          sourceUrl: v.string(),
          quote: v.string(),
          factType: v.union(
            v.literal("exhibitor"),
            v.literal("sponsor"),
            v.literal("speaker"),
            v.literal("agenda"),
            v.literal("other"),
            v.literal("unknown"),
          ),
          confidence: v.number(),
        }),
      ),
      matchedOppValue: v.optional(v.number()),
      eventCompanyId: v.optional(v.id("eventCompany")),
      rank: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return matches.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  },
});

export const getEventScore = query({
  args: { eventId: v.id("event") },
  returns: v.union(
    v.object({
      _id: v.id("eventScore"),
      _creationTime: v.number(),
      eventId: v.id("event"),
      totalEventCost: v.number(),
      revenuePerQualifiedMeeting: v.number(),
      requiredQualifiedMeetings: v.number(),
      sponsorCap: v.number(),
      matchedPipelineValue: v.number(),
      tier1MatchCount: v.number(),
      tier2MatchCount: v.number(),
      recommendation: v.union(
        v.literal("sponsor"),
        v.literal("attend"),
        v.literal("side_event"),
        v.literal("ask_for_data"),
        v.literal("skip"),
      ),
      subScores: v.object({
        pipelinePresence: v.number(),
        evidenceQuality: v.number(),
        costEfficiency: v.number(),
        icpDensity: v.number(),
      }),
      assumptions: v.object({
        sponsorCost: v.number(),
        travelCost: v.number(),
        repTimeCost: v.number(),
        avgDealSize: v.number(),
        meetingToOppRate: v.number(),
        winRate: v.number(),
        riskDiscount: v.number(),
        captureRate: v.number(),
      }),
      rationale: v.array(v.string()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("eventScore")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});

export const getDecisionMemo = query({
  args: { eventId: v.id("event") },
  returns: v.union(
    v.object({
      _id: v.id("decisionMemo"),
      _creationTime: v.number(),
      eventId: v.id("event"),
      eventScoreId: v.id("eventScore"),
      headline: v.string(),
      verdict: v.union(
        v.literal("sponsor"),
        v.literal("attend"),
        v.literal("side_event"),
        v.literal("ask_for_data"),
        v.literal("skip"),
      ),
      sections: v.array(
        v.object({
          title: v.string(),
          body: v.string(),
          citations: v.array(
            v.object({
              sourceDocumentId: v.id("sourceDocument"),
              sourceUrl: v.string(),
              quote: v.string(),
              factType: v.union(
                v.literal("exhibitor"),
                v.literal("sponsor"),
                v.literal("speaker"),
                v.literal("agenda"),
                v.literal("other"),
                v.literal("unknown"),
              ),
              confidence: v.number(),
            }),
          ),
        }),
      ),
      missingEvidence: v.array(v.string()),
      rawAiJson: v.optional(v.string()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisionMemo")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});
