import { v } from "convex/values";

/** Typed evidence spine — every claim traces to a sourceDocument. */
export const evidenceValidator = v.object({
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
});

export const matchTierValidator = v.union(
  v.literal("tier1_crm"),
  v.literal("tier2_icp"),
);

export const crmAccountTypeValidator = v.union(
  v.literal("closed_won"),
  v.literal("open_opp"),
  v.literal("target"),
  v.literal("other"),
);

export const eventCompanyRoleValidator = v.union(
  v.literal("exhibitor"),
  v.literal("sponsor"),
  v.literal("speaker"),
  v.literal("unknown"),
);

export const recommendationValidator = v.union(
  v.literal("sponsor"),
  v.literal("attend"),
  v.literal("side_event"),
  v.literal("ask_for_data"),
  v.literal("skip"),
);

export const jobStepValidator = v.union(
  v.literal("ingest"),
  v.literal("extract"),
  v.literal("match"),
  v.literal("score"),
  v.literal("memo"),
  v.literal("enrich"),
  v.literal("outreach"),
);

export const jobStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("skipped"),
);

export const sourceDocumentKindValidator = v.union(
  v.literal("url"),
  v.literal("paste"),
  v.literal("pdf"),
  v.literal("snapshot"),
);

export const contactVerificationValidator = v.union(
  v.literal("verified"),
  v.literal("likely"),
  v.literal("unknown"),
);

/** Underwriting assumption inputs — Nehal provides values; Kathan owns the formula. */
export const underwritingAssumptionsValidator = v.object({
  sponsorCost: v.number(),
  travelCost: v.number(),
  repTimeCost: v.number(),
  avgDealSize: v.number(),
  meetingToOppRate: v.number(),
  winRate: v.number(),
  riskDiscount: v.number(),
  captureRate: v.number(),
});

export const presenceValidator = v.union(
  v.literal("confirmed"),
  v.literal("recurring"),
);

export const accountMatchFields = {
  eventId: v.id("event"),
  tier: matchTierValidator,
  crmAccountId: v.optional(v.id("crmAccount")),
  companyName: v.string(),
  domain: v.optional(v.string()),
  role: eventCompanyRoleValidator,
  boothOrSession: v.optional(v.string()),
  fitScore: v.number(),
  confidence: v.number(),
  // "confirmed" present this year vs "recurring" (likely to return, from a past edition).
  presence: v.optional(presenceValidator),
  editionLabel: v.optional(v.string()),
  contactName: v.optional(v.string()),
  contactTitle: v.optional(v.string()),
  contactQuote: v.optional(v.string()),
  evidence: v.array(evidenceValidator),
  matchedOppValue: v.optional(v.number()),
  eventCompanyId: v.optional(v.id("eventCompany")),
  rank: v.optional(v.number()),
  createdAt: v.number(),
};
