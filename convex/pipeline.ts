import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { callOpenAiJson } from "./lib/openai";
import {
  AI_GUARDRAILS,
  decisionMemoSchema,
  eventExtractionSchema,
  type DecisionMemoOutput,
  type EventExtractionOutput,
} from "../lib/aiSchemas";

type PipelineResult = {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
};

const MAX_SOURCE_CHARS = 16000;

/**
 * Core Schrute pipeline. Uses OpenAI (gpt-4o-mini, structured outputs) for
 * extraction and the go/no-go memo when OPENAI_API_KEY is set on the Convex
 * deployment, and falls back to the deterministic heuristics otherwise — so a
 * missing key or a transient API error never breaks a run.
 */
export const runPipelineInternal = internalAction({
  args: {
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
  },
  returns: v.object({
    matchCount: v.number(),
    eventScoreId: v.id("eventScore"),
    decisionMemoId: v.id("decisionMemo"),
  }),
  handler: async (ctx, args): Promise<PipelineResult> => {
    // 1. Extract companies — AI first, heuristic fallback.
    const aiExtracted = await runAiExtraction(ctx, args);
    if (!aiExtracted) {
      await ctx.runMutation(internal.ingest.extractFromSource, {
        eventId: args.eventId,
        sourceDocumentId: args.sourceDocumentId,
      });
    }

    // 2. Match against the revenue profile / CRM.
    const matchCount: number = await ctx.runMutation(internal.matcher.run, {
      eventId: args.eventId,
    });

    // 3. Underwrite (deterministic — owns the break-even formula).
    const eventScoreId: Id<"eventScore"> = await ctx.runMutation(
      internal.underwrite.scoreEvent,
      { eventId: args.eventId },
    );

    // 4. Decision memo — AI first, heuristic fallback.
    let decisionMemoId = await runAiMemo(ctx, args.eventId);
    if (!decisionMemoId) {
      decisionMemoId = await ctx.runMutation(internal.memo.generate, {
        eventId: args.eventId,
      });
    }

    return { matchCount, eventScoreId, decisionMemoId };
  },
});

async function runAiExtraction(
  ctx: ActionCtx,
  args: { eventId: Id<"event">; sourceDocumentId: Id<"sourceDocument"> },
): Promise<boolean> {
  try {
    const source = await ctx.runQuery(internal.ingest.getSource, {
      sourceDocumentId: args.sourceDocumentId,
    });
    if (!source?.textContent) return false;

    const ai = await callOpenAiJson<EventExtractionOutput>({
      system: `${AI_GUARDRAILS}\nExtract every company that the source proves is present at the event (exhibitor, sponsor, or speaker). For each, copy a verbatim quote from the source as proof. Use "unknown" for any field not in the source.`,
      user: `Source document text:\n\n${source.textContent.slice(0, MAX_SOURCE_CHARS)}`,
      responseSchema: eventExtractionSchema,
    });

    if (!ai || !ai.companies || ai.companies.length === 0) return false;

    await ctx.runMutation(internal.ingest.applyExtraction, {
      eventId: args.eventId,
      sourceDocumentId: args.sourceDocumentId,
      companies: ai.companies,
      facts: ai.facts ?? [],
    });
    return true;
  } catch (err) {
    console.error("AI extraction failed, falling back to heuristic", err);
    return false;
  }
}

async function runAiMemo(
  ctx: ActionCtx,
  eventId: Id<"event">,
): Promise<Id<"decisionMemo"> | null> {
  try {
    const inputs = await ctx.runQuery(internal.memo.getInputs, { eventId });
    if (!inputs) return null;

    const ai = await callOpenAiJson<DecisionMemoOutput>({
      system: `${AI_GUARDRAILS}\nYou are Schrute, a blunt GTM analyst. Write a go/no-go memo for whether a B2B team should spend on this event. Be concise and decisive. citationQuotes MUST be copied verbatim from the evidence quotes provided — never invent quotes. Align verdict with the underwriting recommendation unless the evidence clearly contradicts it.`,
      user: buildMemoPrompt(inputs),
      responseSchema: decisionMemoSchema,
    });

    if (!ai || !ai.sections) return null;

    const decisionMemoId: Id<"decisionMemo"> = await ctx.runMutation(
      internal.memo.write,
      {
        eventId,
        headline: ai.headline,
        verdict: ai.verdict,
        sections: ai.sections.map((s) => ({
          title: s.title,
          body: s.body,
          citationQuotes: s.citationQuotes ?? [],
        })),
        missingEvidence: ai.missingEvidence ?? [],
        rawAiJson: JSON.stringify(ai),
      },
    );
    return decisionMemoId;
  } catch (err) {
    console.error("AI memo failed, falling back to heuristic", err);
    return null;
  }
}

type MemoInputs = {
  event: { name: string; location: string | null };
  score: {
    recommendation: string;
    sponsorCap: number;
    totalEventCost: number;
    requiredQualifiedMeetings: number;
    matchedPipelineValue: number;
    tier1MatchCount: number;
    tier2MatchCount: number;
  };
  matches: Array<{
    companyName: string;
    tier: string;
    role: string;
    boothOrSession: string | null;
    matchedOppValue: number | null;
    quotes: string[];
  }>;
};

function buildMemoPrompt(inputs: MemoInputs): string {
  const { event, score, matches } = inputs;
  const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const matchLines = matches
    .slice(0, 30)
    .map((m) => {
      const bits = [
        `${m.companyName} [${m.tier}] ${m.role}`,
        m.boothOrSession ? m.boothOrSession : null,
        m.matchedOppValue ? `open opp ${usd(m.matchedOppValue)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const quote = m.quotes[0] ? ` :: "${m.quotes[0]}"` : "";
      return `- ${bits}${quote}`;
    })
    .join("\n");

  return [
    `Event: ${event.name}${event.location ? ` (${event.location})` : ""}`,
    `Underwriting recommendation: ${score.recommendation}`,
    `Economics: all-in cost ${usd(score.totalEventCost)}, needs ${score.requiredQualifiedMeetings} qualified meetings to break even, sponsor cap ${usd(score.sponsorCap)}.`,
    `Matched pipeline value: ${usd(score.matchedPipelineValue)}. Tier-1 CRM accounts present: ${score.tier1MatchCount}. Tier-2 net-new ICP: ${score.tier2MatchCount}.`,
    "",
    "Matched accounts and their evidence quotes (use these for citationQuotes):",
    matchLines || "- (no matched accounts)",
  ].join("\n");
}
