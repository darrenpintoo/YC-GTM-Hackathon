import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { matchAccounts } from "./lib/matching";
import { upsertJob } from "./lib/jobs";
import type { Id } from "./_generated/dataModel";
import { buildAccountMeetingReason } from "../lib/accountMeetingReason";

export const run = internalMutation({
  args: {
    eventId: v.id("event"),
    warmCache: v.optional(v.boolean()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "match", {
      status: "running",
      message: args.warmCache
        ? "Matching confirmed companies (cached replay)"
        : "Matching confirmed companies to CRM accounts",
      progress: 10,
    });

    const event = await ctx.db.get("event", args.eventId);
    if (!event?.revenueProfileId) {
      throw new Error("Event is missing revenueProfileId");
    }

    const profile = await ctx.db.get("revenueProfile", event.revenueProfileId);
    if (!profile) {
      throw new Error("Revenue profile not found");
    }

    const crmAccounts = await ctx.db
      .query("crmAccount")
      .withIndex("by_revenue_profile", (q) =>
        q.eq("revenueProfileId", event.revenueProfileId!),
      )
      .collect();

    const eventCompanies = await ctx.db
      .query("eventCompany")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const sourceCache = new Map<Id<"sourceDocument">, { url: string }>();
    const companies = [];
    for (const company of eventCompanies) {
      let source = sourceCache.get(company.sourceDocumentId);
      if (!source) {
        const doc = await ctx.db.get("sourceDocument", company.sourceDocumentId);
        source = { url: doc?.url ?? "" };
        sourceCache.set(company.sourceDocumentId, source);
      }
      companies.push({
        _id: company._id,
        companyName: company.companyName,
        domain: company.domain,
        role: company.role,
        boothOrSession: company.boothOrSession,
        quote: company.quote,
        confidence: company.confidence,
        sourceDocumentId: company.sourceDocumentId,
        sourceUrl: source.url,
        presence: company.presence ?? "confirmed",
        editionLabel: company.editionLabel,
        contactName: company.contactName,
        contactTitle: company.contactTitle,
        contactQuote: company.contactQuote,
      });
    }

    const candidates = matchAccounts(
      companies,
      crmAccounts.map((crm) => ({
        _id: crm._id,
        companyName: crm.companyName,
        domain: crm.domain,
        accountType: crm.accountType,
        industry: crm.industry,
        openOppValue: crm.openOppValue,
      })),
      {
        industries: profile.industries,
        buyerTitles: profile.buyerTitles,
        keywords: profile.keywords,
        geographies: profile.geographies,
      },
    );

    const existing = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete("accountMatch", row._id);
    }

    const now = Date.now();
    let rank = 1;
    for (const candidate of candidates) {
      const evidence = {
        sourceDocumentId: candidate.evidence
          .sourceDocumentId as Id<"sourceDocument">,
        sourceUrl: candidate.evidence.sourceUrl,
        quote: candidate.evidence.quote,
        factType: candidate.evidence.factType,
        confidence: candidate.evidence.confidence,
      };
      const meetingReason = buildAccountMeetingReason({
        eventName: event.name,
        sellerName: profile.name,
        buyerTitles: profile.buyerTitles,
        companyName: candidate.companyName,
        domain: candidate.domain,
        tier: candidate.tier,
        role: candidate.role,
        boothOrSession: candidate.boothOrSession,
        matchedOppValue: candidate.matchedOppValue,
        contactName: candidate.contactName,
        contactTitle: candidate.contactTitle,
        evidenceQuote: candidate.evidence.quote,
        presence: candidate.presence ?? "confirmed",
        editionLabel: candidate.editionLabel,
      });

      await ctx.db.insert("accountMatch", {
        eventId: args.eventId,
        tier: candidate.tier,
        crmAccountId: candidate.crmAccountId as Id<"crmAccount"> | undefined,
        companyName: candidate.companyName,
        domain: candidate.domain,
        role: candidate.role,
        boothOrSession: candidate.boothOrSession,
        fitScore: candidate.fitScore,
        confidence: candidate.confidence,
        presence: candidate.presence ?? "confirmed",
        editionLabel: candidate.editionLabel,
        contactName: candidate.contactName,
        contactTitle: candidate.contactTitle,
        contactQuote: candidate.contactQuote,
        evidence: [evidence],
        matchedOppValue: candidate.matchedOppValue,
        eventCompanyId: candidate.eventCompanyId as Id<"eventCompany">,
        rank,
        meetingReason,
        createdAt: now,
      });
      rank += 1;
    }

    await upsertJob(ctx, args.eventId, "match", {
      status: "completed",
      message: `${candidates.length} account matches ranked`,
      progress: 100,
    });

    return candidates.length;
  },
});
