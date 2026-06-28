import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { upsertJob } from "./lib/jobs";

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
