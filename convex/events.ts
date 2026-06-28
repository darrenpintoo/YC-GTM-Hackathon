import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_UNDERWRITING_ASSUMPTIONS } from "./lib/defaults";
import { initCoreJobs } from "./lib/jobs";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    sponsorQuote: v.optional(v.number()),
    revenueProfileId: v.optional(v.id("revenueProfile")),
  },
  returns: v.id("event"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("event")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch("event", existing._id, {
        name: args.name,
        startDate: args.startDate,
        endDate: args.endDate,
        location: args.location,
        sponsorQuote: args.sponsorQuote,
        revenueProfileId: args.revenueProfileId,
        assumptions: DEFAULT_UNDERWRITING_ASSUMPTIONS,
      });
      return existing._id;
    }

    const eventId = await ctx.db.insert("event", {
      name: args.name,
      slug: args.slug,
      startDate: args.startDate,
      endDate: args.endDate,
      location: args.location,
      sponsorQuote: args.sponsorQuote,
      revenueProfileId: args.revenueProfileId,
      assumptions: DEFAULT_UNDERWRITING_ASSUMPTIONS,
      createdAt: Date.now(),
    });

    await initCoreJobs(ctx, eventId);
    return eventId;
  },
});

export const get = query({
  args: { eventId: v.id("event") },
  returns: v.union(
    v.object({
      _id: v.id("event"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      location: v.optional(v.string()),
      sponsorQuote: v.optional(v.number()),
      revenueProfileId: v.optional(v.id("revenueProfile")),
      assumptions: v.optional(
        v.object({
          sponsorCost: v.number(),
          travelCost: v.number(),
          repTimeCost: v.number(),
          avgDealSize: v.number(),
          meetingToOppRate: v.number(),
          winRate: v.number(),
          riskDiscount: v.number(),
          captureRate: v.number(),
        }),
      ),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get("event", args.eventId);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("event"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      location: v.optional(v.string()),
      sponsorQuote: v.optional(v.number()),
      revenueProfileId: v.optional(v.id("revenueProfile")),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("event")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});
