import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { upsertJob } from "./lib/jobs";

const RECOMMENDATIONS = [
  "sponsor",
  "attend",
  "side_event",
  "ask_for_data",
  "skip",
] as const;
type Recommendation = (typeof RECOMMENDATIONS)[number];

/** Gather everything the AI memo prompt needs (read-only). */
export const getInputs = internalQuery({
  args: { eventId: v.id("event") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get("event", args.eventId);
    const score = await ctx.db
      .query("eventScore")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();
    if (!event || !score) return null;

    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return {
      event: { name: event.name, location: event.location ?? null },
      score: {
        recommendation: score.recommendation,
        sponsorCap: score.sponsorCap,
        totalEventCost: score.totalEventCost,
        requiredQualifiedMeetings: score.requiredQualifiedMeetings,
        matchedPipelineValue: score.matchedPipelineValue,
        tier1MatchCount: score.tier1MatchCount,
        tier2MatchCount: score.tier2MatchCount,
      },
      matches: matches.map((m) => ({
        companyName: m.companyName,
        tier: m.tier,
        role: m.role,
        boothOrSession: m.boothOrSession ?? null,
        matchedOppValue: m.matchedOppValue ?? null,
        quotes: m.evidence.map((e) => e.quote),
      })),
    };
  },
});

/** Persist an AI-authored memo, resolving citation quotes back to evidence. */
export const write = internalMutation({
  args: {
    eventId: v.id("event"),
    headline: v.string(),
    verdict: v.string(),
    sections: v.array(
      v.object({
        title: v.string(),
        body: v.string(),
        citationQuotes: v.array(v.string()),
      }),
    ),
    missingEvidence: v.array(v.string()),
    rawAiJson: v.string(),
  },
  returns: v.id("decisionMemo"),
  handler: async (ctx, args) => {
    const score = await ctx.db
      .query("eventScore")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();
    if (!score) throw new Error("Event score required before memo generation");

    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const source = await ctx.db
      .query("sourceDocument")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();

    const evidencePool = matches.flatMap((m) => m.evidence);

    function resolveCitation(quote: string) {
      const needle = quote.trim().toLowerCase();
      if (!needle) return null;
      const hit = evidencePool.find((e) => {
        const hay = e.quote.trim().toLowerCase();
        return hay.includes(needle) || needle.includes(hay);
      });
      if (hit) return hit;
      if (!source) return null;
      return {
        sourceDocumentId: source._id,
        sourceUrl: source.url ?? "",
        quote,
        factType: "other" as const,
        confidence: 0.5,
      };
    }

    const sections = args.sections.map((s) => ({
      title: s.title,
      body: s.body,
      citations: s.citationQuotes
        .map(resolveCitation)
        .filter((c): c is NonNullable<typeof c> => c !== null),
    }));

    const verdict: Recommendation = (
      RECOMMENDATIONS as readonly string[]
    ).includes(args.verdict)
      ? (args.verdict as Recommendation)
      : score.recommendation;

    const payload = {
      eventId: args.eventId,
      eventScoreId: score._id,
      headline: args.headline,
      verdict,
      sections,
      missingEvidence: args.missingEvidence,
      rawAiJson: args.rawAiJson,
      createdAt: Date.now(),
    };

    const existing = await ctx.db
      .query("decisionMemo")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();

    let memoId;
    if (existing) {
      await ctx.db.patch("decisionMemo", existing._id, payload);
      memoId = existing._id;
    } else {
      memoId = await ctx.db.insert("decisionMemo", payload);
    }

    await upsertJob(ctx, args.eventId, "memo", {
      status: "completed",
      message: `${args.headline} · gpt-4o-mini`,
      progress: 100,
    });

    return memoId;
  },
});

export const generate = internalMutation({
  args: { eventId: v.id("event") },
  returns: v.id("decisionMemo"),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "memo", {
      status: "running",
      message: "Generating go/no-go memo",
      progress: 20,
    });

    const event = await ctx.db.get("event", args.eventId);
    const score = await ctx.db
      .query("eventScore")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!event || !score) {
      throw new Error("Event score required before memo generation");
    }

    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const openOppValue = matches
      .filter((m) => m.matchedOppValue)
      .reduce((sum, m) => sum + (m.matchedOppValue ?? 0), 0);

    const topEvidence = matches
      .flatMap((m) => m.evidence)
      .slice(0, 3);

    const headlineByVerdict: Record<string, string> = {
      sponsor: `Sponsor up to $${Math.round(score.sponsorCap).toLocaleString()}`,
      attend: `Attend — don't sponsor over $${Math.round(score.sponsorCap).toLocaleString()}`,
      side_event: "Host a side event — skip the booth",
      ask_for_data: "Ask for more event data before committing spend",
      skip: "Skip — pipeline presence doesn't justify the spend",
    };

    const headline = headlineByVerdict[score.recommendation] ?? "Review event economics";

    const sections = [
      {
        title: "Confirmed account presence",
        body: `${score.tier1MatchCount} Tier-1 CRM accounts are confirmed present at ${event.name} from public exhibitor/sponsor evidence — not inferred personal attendance.`,
        citations: topEvidence,
      },
      {
        title: "Pipeline on the floor",
        body: `Matched open pipeline: $${Math.round(openOppValue).toLocaleString()}. Total counted pipeline value in score: $${Math.round(score.matchedPipelineValue).toLocaleString()}.`,
        citations: [],
      },
      {
        title: "Economics",
        body: `All-in cost ~$${Math.round(score.totalEventCost).toLocaleString()} needs ${score.requiredQualifiedMeetings} qualified meetings to break even. Sponsor cap: $${Math.round(score.sponsorCap).toLocaleString()}.`,
        citations: [],
      },
    ];

    const missingEvidence: string[] = [];
    if (matches.length === 0) {
      missingEvidence.push("No account matches — ingest a richer exhibitor source pack.");
    }
    if (score.subScores.evidenceQuality < 0.6) {
      missingEvidence.push("Evidence confidence is moderate — prefer cached exhibitor PDFs or sponsor lists.");
    }

    const existing = await ctx.db
      .query("decisionMemo")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();

    const payload = {
      eventId: args.eventId,
      eventScoreId: score._id,
      headline,
      verdict: score.recommendation,
      sections,
      missingEvidence,
      createdAt: Date.now(),
    };

    let memoId;
    if (existing) {
      await ctx.db.patch("decisionMemo", existing._id, payload);
      memoId = existing._id;
    } else {
      memoId = await ctx.db.insert("decisionMemo", payload);
    }

    await upsertJob(ctx, args.eventId, "memo", {
      status: "completed",
      message: headline,
      progress: 100,
    });

    return memoId;
  },
});
