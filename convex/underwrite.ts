import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_UNDERWRITING_ASSUMPTIONS } from "./lib/defaults";
import { computeUnderwriting } from "./lib/underwriting";
import { upsertJob } from "./lib/jobs";
import { underwritingAssumptionsValidator } from "./lib/validators";

export const scoreEvent = internalMutation({
  args: { eventId: v.id("event") },
  returns: v.id("eventScore"),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "score", {
      status: "running",
      message: "Running break-even underwriting",
      progress: 20,
    });

    const event = await ctx.db.get("event", args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const tier1Matches = matches.filter((m) => m.tier === "tier1_crm");
    const tier2Matches = matches.filter((m) => m.tier === "tier2_icp");
    const openOppMatches = tier1Matches.filter((m) => m.matchedOppValue);

    const matchedPipelineValue = openOppMatches.reduce(
      (sum, match) => sum + (match.matchedOppValue ?? 0),
      0,
    );

    const avgMatchConfidence =
      matches.length > 0
        ? matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length
        : 0;

    const assumptions = event.assumptions ?? DEFAULT_UNDERWRITING_ASSUMPTIONS;
    const result = computeUnderwriting({
      assumptions,
      matchedPipelineValue,
      tier1MatchCount: tier1Matches.length,
      tier2MatchCount: tier2Matches.length,
      openOppMatchCount: openOppMatches.length,
      avgMatchConfidence,
      sponsorQuote: event.sponsorQuote,
    });

    const existing = await ctx.db
      .query("eventScore")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();

    const payload = {
      eventId: args.eventId,
      totalEventCost: result.totalEventCost,
      revenuePerQualifiedMeeting: result.revenuePerQualifiedMeeting,
      requiredQualifiedMeetings: result.requiredQualifiedMeetings,
      sponsorCap: result.sponsorCap,
      matchedPipelineValue,
      tier1MatchCount: tier1Matches.length,
      tier2MatchCount: tier2Matches.length,
      recommendation: result.recommendation,
      subScores: result.subScores,
      assumptions,
      rationale: result.rationale,
      createdAt: Date.now(),
    };

    let scoreId;
    if (existing) {
      await ctx.db.patch("eventScore", existing._id, payload);
      scoreId = existing._id;
    } else {
      scoreId = await ctx.db.insert("eventScore", payload);
    }

    await upsertJob(ctx, args.eventId, "score", {
      status: "completed",
      message: `Recommendation: ${result.recommendation}`,
      progress: 100,
    });

    return scoreId;
  },
});

/** Nehal supplies assumption values; Kathan's underwrite engine consumes them. */
export const updateAssumptions = mutation({
  args: {
    eventId: v.id("event"),
    assumptions: underwritingAssumptionsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get("event", args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    await ctx.db.patch("event", args.eventId, {
      assumptions: args.assumptions,
    });
    return null;
  },
});
