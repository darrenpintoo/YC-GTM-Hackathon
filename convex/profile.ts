import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { parseCsv, parseOptionalNumber } from "./lib/csvParse";
import { buildProfileHeuristic, mapAccountType } from "./lib/profileHeuristic";

export const buildFromCsv = mutation({
  args: {
    csvText: v.string(),
    profileName: v.string(),
  },
  returns: v.id("revenueProfile"),
  handler: async (ctx, args) => {
    const rows = parseCsv(args.csvText);
    if (rows.length === 0) {
      throw new Error("CSV is empty or invalid");
    }

    const profile = buildProfileHeuristic(rows, args.profileName);
    const now = Date.now();

    const profileId = await ctx.db.insert("revenueProfile", {
      name: args.profileName,
      industries: profile.industries,
      buyerTitles: profile.buyerTitles,
      dealSizeClusters: profile.dealSizeClusters,
      geographies: profile.geographies,
      keywords: profile.keywords,
      closedWonPatterns: profile.closedWonPatterns,
      createdAt: now,
    });

    for (const row of rows) {
      await ctx.db.insert("crmAccount", {
        revenueProfileId: profileId,
        companyName: row.company_name ?? row.company ?? "Unknown",
        domain: row.domain || undefined,
        accountType: mapAccountType(row.account_type),
        stage: row.stage || undefined,
        dealSize: parseOptionalNumber(row.deal_size),
        industry: row.industry || undefined,
        region: row.region || undefined,
        buyerTitle: row.buyer_title || undefined,
        openOppValue: parseOptionalNumber(row.open_opp_value),
        createdAt: now,
      });
    }

    return profileId;
  },
});

export const get = query({
  args: { profileId: v.id("revenueProfile") },
  returns: v.union(
    v.object({
      _id: v.id("revenueProfile"),
      _creationTime: v.number(),
      name: v.string(),
      industries: v.array(v.string()),
      buyerTitles: v.array(v.string()),
      dealSizeClusters: v.array(
        v.object({
          label: v.string(),
          min: v.number(),
          max: v.number(),
          count: v.number(),
        }),
      ),
      geographies: v.array(v.string()),
      keywords: v.array(v.string()),
      closedWonPatterns: v.array(v.string()),
      rawAiJson: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get("revenueProfile", args.profileId);
  },
});

export const listAccounts = query({
  args: { profileId: v.id("revenueProfile") },
  returns: v.array(
    v.object({
      _id: v.id("crmAccount"),
      _creationTime: v.number(),
      revenueProfileId: v.id("revenueProfile"),
      companyName: v.string(),
      domain: v.optional(v.string()),
      accountType: v.union(
        v.literal("closed_won"),
        v.literal("open_opp"),
        v.literal("target"),
        v.literal("other"),
      ),
      stage: v.optional(v.string()),
      dealSize: v.optional(v.number()),
      industry: v.optional(v.string()),
      region: v.optional(v.string()),
      buyerTitle: v.optional(v.string()),
      openOppValue: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crmAccount")
      .withIndex("by_revenue_profile", (q) =>
        q.eq("revenueProfileId", args.profileId),
      )
      .collect();
  },
});
