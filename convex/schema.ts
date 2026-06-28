import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accountMatchFields,
  contactVerificationValidator,
  crmAccountTypeValidator,
  eventCompanyRoleValidator,
  evidenceValidator,
  jobStatusValidator,
  jobStepValidator,
  recommendationValidator,
  sourceDocumentKindValidator,
  underwritingAssumptionsValidator,
} from "./lib/validators";

export default defineSchema({
  revenueProfile: defineTable({
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

  crmAccount: defineTable({
    revenueProfileId: v.id("revenueProfile"),
    companyName: v.string(),
    domain: v.optional(v.string()),
    accountType: crmAccountTypeValidator,
    stage: v.optional(v.string()),
    dealSize: v.optional(v.number()),
    industry: v.optional(v.string()),
    region: v.optional(v.string()),
    buyerTitle: v.optional(v.string()),
    openOppValue: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_revenue_profile", ["revenueProfileId"])
    .index("by_domain", ["domain"])
    .index("by_revenue_profile_and_type", ["revenueProfileId", "accountType"]),

  event: defineTable({
    name: v.string(),
    slug: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    sponsorQuote: v.optional(v.number()),
    revenueProfileId: v.optional(v.id("revenueProfile")),
    assumptions: v.optional(underwritingAssumptionsValidator),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  sourceDocument: defineTable({
    eventId: v.id("event"),
    kind: sourceDocumentKindValidator,
    url: v.optional(v.string()),
    title: v.optional(v.string()),
    // Research bucket: sponsors | exhibitors | speakers | program | news | event | other | past_edition
    category: v.optional(v.string()),
    // True when this page is a past edition / indirect source (not this year's event).
    recurring: v.optional(v.boolean()),
    // Human label for the edition, e.g. "ICRA 2024".
    editionLabel: v.optional(v.string()),
    textContent: v.string(),
    contentHash: v.string(),
    snapshotStorageId: v.optional(v.id("_storage")),
    fetchedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_hash", ["contentHash"]),

  eventFact: defineTable({
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
    factType: v.union(
      v.literal("exhibitor_list"),
      v.literal("sponsor_list"),
      v.literal("speaker_list"),
      v.literal("agenda"),
      v.literal("booth_map"),
      v.literal("other"),
      v.literal("unknown"),
    ),
    label: v.string(),
    value: v.string(),
    quote: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_source", ["sourceDocumentId"]),

  eventCompany: defineTable({
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
    companyName: v.string(),
    normalizedName: v.optional(v.string()),
    domain: v.optional(v.string()),
    role: eventCompanyRoleValidator,
    boothOrSession: v.optional(v.string()),
    quote: v.string(),
    confidence: v.number(),
    // "confirmed" = named in a current-edition source; "recurring" = past edition / indirect.
    presence: v.optional(
      v.union(v.literal("confirmed"), v.literal("recurring")),
    ),
    editionLabel: v.optional(v.string()),
    // Named person in source tied to this company (speaker, rep, etc.).
    contactName: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    contactQuote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_and_domain", ["eventId", "domain"])
    .index("by_source", ["sourceDocumentId"]),

  accountMatch: defineTable(accountMatchFields)
    .index("by_event", ["eventId"])
    .index("by_event_and_tier", ["eventId", "tier"])
    .index("by_crm_account", ["crmAccountId"]),

  eventScore: defineTable({
    eventId: v.id("event"),
    totalEventCost: v.number(),
    revenuePerQualifiedMeeting: v.number(),
    requiredQualifiedMeetings: v.number(),
    sponsorCap: v.number(),
    matchedPipelineValue: v.number(),
    tier1MatchCount: v.number(),
    tier2MatchCount: v.number(),
    recommendation: recommendationValidator,
    subScores: v.object({
      pipelinePresence: v.number(),
      evidenceQuality: v.number(),
      costEfficiency: v.number(),
      icpDensity: v.number(),
    }),
    assumptions: underwritingAssumptionsValidator,
    rationale: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_event", ["eventId"]),

  decisionMemo: defineTable({
    eventId: v.id("event"),
    eventScoreId: v.id("eventScore"),
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
    rawAiJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_event", ["eventId"]),

  contact: defineTable({
    accountMatchId: v.id("accountMatch"),
    eventId: v.id("event"),
    fullName: v.string(),
    title: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    verification: contactVerificationValidator,
    fiberRawJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_account_match", ["accountMatchId"])
    .index("by_event", ["eventId"]),

  outreachDraft: defineTable({
    accountMatchId: v.id("accountMatch"),
    contactId: v.optional(v.id("contact")),
    eventId: v.id("event"),
    subject: v.string(),
    body: v.string(),
    tone: v.optional(v.string()),
    rawAiJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_account_match", ["accountMatchId"])
    .index("by_event", ["eventId"]),

  // Prospective attendees surfaced from public posts/pages (OpenAI web search).
  // A social signal, never an inferred attendance claim — we quote the source.
  eventAttendee: defineTable({
    eventId: v.id("event"),
    accountMatchId: v.optional(v.id("accountMatch")),
    fullName: v.string(),
    title: v.string(),
    companyName: v.string(),
    matchTier: v.optional(
      v.union(v.literal("tier1_crm"), v.literal("tier2_icp")),
    ),
    // "web" = sourced from a public event page (e.g. a named speaker), not a social post.
    network: v.union(v.literal("linkedin"), v.literal("x"), v.literal("web")),
    postQuote: v.string(),
    postedAt: v.optional(v.string()),
    confidence: v.number(),
    profileUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    // Fiber-sourced enrichment (best-effort; absent when unavailable).
    email: v.optional(v.string()),
    emailStatus: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    enrichedTitle: v.optional(v.string()),
    // One-line AI rationale for why this person is a good match.
    matchReason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_event", ["eventId"]),

  jobs: defineTable({
    eventId: v.id("event"),
    step: jobStepValidator,
    status: jobStatusValidator,
    message: v.optional(v.string()),
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_and_step", ["eventId", "step"]),
});
