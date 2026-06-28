import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { extractCompaniesHeuristicWithCoverage } from "./lib/extractHeuristic";
import { callOpenAiJson } from "./lib/openai";
import {
  categorySortKey,
  scoreSourceQuality,
} from "./lib/sourceQuality";
import { paceWarmStage } from "./lib/warmPace";
import {
  AI_GUARDRAILS,
  companyFilterSchema,
  decisionMemoSchema,
  eventExtractionSchema,
  type CompanyFilterOutput,
  type DecisionMemoOutput,
  type EventExtractionOutput,
} from "../lib/aiSchemas";

type PipelineResult = {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
};

export type FullPipelineResult = PipelineResult & {
  sourceCount: number;
};

const MAX_SOURCE_CHARS = 16000;
const MAX_DOCS_TO_EXTRACT = 50;

const runIntentValidator = v.optional(
  v.object({
    objective: v.optional(v.string()),
    participationOptions: v.optional(v.array(v.string())),
    repCount: v.optional(v.number()),
  }),
);

/**
 * Full Schrute pipeline (streaming-friendly). Each stage writes a reactive job
 * row, so the UI can follow ingest -> extract -> match -> score -> memo live.
 *
 * - ingest:  Firecrawl scrape of the event source (plain fetch / snapshot fallback)
 * - extract: OpenAI structured extraction (heuristic fallback)
 * - match:   deterministic CRM/ICP matching
 * - score:   deterministic break-even underwriting
 * - memo:    OpenAI go/no-go memo (heuristic fallback)
 * - enrich:  scheduled sidecar (web-search attendees + Fiber contacts)
 *
 * A missing key or transient API error never breaks a run.
 */
export const runFullPipeline = internalAction({
  args: {
    eventId: v.id("event"),
    eventName: v.string(),
    eventSource: v.string(),
    runIntent: runIntentValidator,
    warmCache: v.optional(v.boolean()),
  },
  returns: v.object({
    matchCount: v.number(),
    eventScoreId: v.id("eventScore"),
    decisionMemoId: v.id("decisionMemo"),
    sourceCount: v.number(),
  }),
  handler: async (ctx, args): Promise<FullPipelineResult> => {
    // 0. Gather sources — deep research across the event site + open web.
    await ctx.runMutation(internal.ingest.startIngest, {
      eventId: args.eventId,
      message: "Starting deep research…",
    });

    const gathered = await ctx.runAction(internal.research.gather, {
      eventId: args.eventId,
      eventName: args.eventName,
      eventSource: args.eventSource,
      warmCache: args.warmCache,
    });

    if (args.warmCache) {
      await paceWarmStage("gather");
    }

    // 1. Extract companies across ALL gathered sources — AI first, heuristic
    // fallback per document.
    await ctx.runMutation(internal.ingest.markExtractRunning, {
      eventId: args.eventId,
      message: args.warmCache
        ? "Reading sources (cached extraction replay)…"
        : undefined,
    });
    const extracted = await runMultiDocExtraction(
      ctx,
      args.eventId,
      args.warmCache,
    );
    if (!extracted) {
      await ctx.runMutation(internal.ingest.extractAllHeuristic, {
        eventId: args.eventId,
      });
    }

    if (args.warmCache) {
      await paceWarmStage("extract");
    }

    // 2. Match against the revenue profile / CRM.
    const matchCount: number = await ctx.runMutation(internal.matcher.run, {
      eventId: args.eventId,
      warmCache: args.warmCache,
    });
    
    await ctx.runAction(internal.enrich.generateMeetingReasons, {
      eventId: args.eventId,
    });
    
    if (args.warmCache) {
      await paceWarmStage("match");
    }

    // 3. Underwrite (deterministic — owns the break-even formula).
    const eventScoreId: Id<"eventScore"> = await ctx.runMutation(
      internal.underwrite.scoreEvent,
      { eventId: args.eventId, warmCache: args.warmCache },
    );

    if (args.warmCache) {
      await paceWarmStage("score");
    }

    // 4. Decision memo — AI first, heuristic fallback.
    const aiMemoId = await runAiMemo(ctx, args.eventId, args.runIntent, args.warmCache);
    const decisionMemoId: Id<"decisionMemo"> =
      aiMemoId ??
      (await ctx.runMutation(internal.memo.generate, {
        eventId: args.eventId,
        warmCache: args.warmCache,
      }));

    if (args.warmCache) {
      await paceWarmStage("memo");
    }

    // 5. Enrichment sidecar — runs in the background so results show now and
    // the People tab fills in reactively as web search + Fiber complete.
    if (args.warmCache) {
      await paceWarmStage("enrichKickoff");
    }
    await ctx.scheduler.runAfter(0, internal.enrich.run, {
      eventId: args.eventId,
      runIntent: args.runIntent,
      warmCache: args.warmCache,
    });

    return {
      matchCount,
      eventScoreId,
      decisionMemoId,
      sourceCount: gathered.sourceCount,
    };
  },
});

/**
 * Extract companies from every gathered source document, attributing each to
 * its page so citations resolve correctly. Returns true if any company found.
 */
async function runMultiDocExtraction(
  ctx: ActionCtx,
  eventId: Id<"event">,
  warmCache?: boolean,
): Promise<boolean> {
  try {
    const [docs, extractCtx] = await Promise.all([
      ctx.runQuery(internal.ingest.listSourcesForExtraction, { eventId }),
      ctx.runQuery(internal.ingest.getExtractContext, { eventId }),
    ]);
    if (docs.length === 0) return false;

    type CompanyRow = {
      sourceDocumentId: Id<"sourceDocument">;
      companyName: string;
      role: string;
      boothOrSession: string;
      quote: string;
      confidence: number;
      presence: "confirmed" | "recurring";
      editionLabel?: string;
      contactName?: string;
      contactTitle?: string;
      contactQuote?: string;
      extractionMethod?: "ai" | "heuristic" | "hybrid";
      orgType?: string;
      sourceSignalTier?: string;
    };

    const companies: CompanyRow[] = [];
    const facts: Array<{
      sourceDocumentId: Id<"sourceDocument">;
      factType: string;
      label: string;
      value: string;
      quote: string;
      confidence: number;
    }> = [];

    const usableDocs = docs
      .filter((d) => d.textContent && d.textContent.length >= 80)
      .sort(
        (a, b) =>
          categorySortKey(a.category, a.recurring) -
          categorySortKey(b.category, b.recurring),
      )
      .slice(0, MAX_DOCS_TO_EXTRACT);

    let skipped = 0;
    let processed = 0;
    const concurrency = 12;

    for (let i = 0; i < usableDocs.length; i += concurrency) {
      const chunk = usableDocs.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map(async (doc) => {
          const quality = scoreSourceQuality(
            doc.textContent,
            doc.category,
            doc.signalTier ?? undefined,
            doc.charCount,
          );

          if (
            quality.route === "skip" ||
            doc.scrapeStatus === "empty" ||
            doc.scrapeStatus === "failed"
          ) {
            return { doc, skipped: true as const };
          }

          if (quality.route === "hybrid") {
            const heuristic = extractCompaniesHeuristicWithCoverage(
              doc.textContent,
            );
            if (heuristic.coverage >= 0.6 && heuristic.companies.length >= 3) {
              const ai = await callOpenAiJson<EventExtractionOutput>({
                system: `${AI_GUARDRAILS}\nValidate and extend this heuristic company list against the source. Add missing companies, named contacts, and fix roles. Copy verbatim quotes.`,
                user: [
                  `Heuristic extractions (JSON):\n${JSON.stringify(heuristic.companies.slice(0, 40))}`,
                  `\nSource document text:\n\n${doc.textContent.slice(0, MAX_SOURCE_CHARS)}`,
                ].join("\n"),
                responseSchema: eventExtractionSchema,
              });
              return {
                doc,
                ai,
                extractionMethod: "hybrid" as const,
                skipped: false as const,
              };
            }
          }

          const ai = await callOpenAiJson<EventExtractionOutput>({
            system: `${AI_GUARDRAILS}\nExtract every company that the source proves is present at the event (exhibitor, sponsor, or speaker). For each, copy a verbatim quote from the source as proof. If the source names a person at that company (speaker, booth rep, keynote), fill contactName/contactTitle/contactQuote with a verbatim line — otherwise use empty strings. Use "unknown" for any field not in the source.`,
            user: `Source document text:\n\n${doc.textContent.slice(0, MAX_SOURCE_CHARS)}`,
            responseSchema: eventExtractionSchema,
          });
          return {
            doc,
            ai,
            extractionMethod: "ai" as const,
            skipped: false as const,
          };
        }),
      );

      for (const result of results) {
        if (result.skipped) {
          skipped += 1;
          continue;
        }
        const { doc, ai, extractionMethod } = result;
        const presence: "confirmed" | "recurring" = doc.recurring
          ? "recurring"
          : "confirmed";
        const signalTier = doc.signalTier ?? undefined;

        if (ai?.companies) {
          for (const c of ai.companies) {
            const cn = c.contactName?.trim();
            const ct = c.contactTitle?.trim();
            const cq = c.contactQuote?.trim();
            companies.push({
              sourceDocumentId: doc._id,
              companyName: c.companyName,
              role: c.role,
              boothOrSession: c.boothOrSession,
              quote: c.quote,
              confidence: c.confidence,
              presence,
              editionLabel: doc.editionLabel ?? undefined,
              contactName: cn && cn !== "unknown" ? cn : undefined,
              contactTitle: ct && ct !== "unknown" ? ct : undefined,
              contactQuote: cq && cq !== "unknown" ? cq : undefined,
              extractionMethod,
              sourceSignalTier: signalTier,
            });
          }
        }
        for (const f of ai?.facts ?? []) {
          facts.push({ sourceDocumentId: doc._id, ...f });
        }
      }

      processed += chunk.length;
      await ctx.runMutation(internal.ingest.markExtractRunning, {
        eventId,
        message: warmCache
          ? `Reading sources ${processed}/${usableDocs.length} (cached)${skipped > 0 ? ` · ${skipped} skipped` : ""}…`
          : `Reading sources ${processed}/${usableDocs.length}${skipped > 0 ? ` · ${skipped} skipped (low signal)` : ""}…`,
        progress: Math.min(
          90,
          10 + Math.round((processed / usableDocs.length) * 80),
        ),
      });
    }

    if (companies.length === 0) return false;

    const filtered = await filterCompaniesWithAi(companies, extractCtx);

    await ctx.runMutation(internal.ingest.applyExtraction, {
      eventId,
      companies: filtered,
      facts,
    });
    return true;
  } catch (err) {
    console.error("Multi-doc AI extraction failed, falling back", err);
    return false;
  }
}

type ExtractCompanyRow = {
  sourceDocumentId: Id<"sourceDocument">;
  companyName: string;
  role: string;
  boothOrSession: string;
  quote: string;
  confidence: number;
  presence: "confirmed" | "recurring";
  editionLabel?: string;
  contactName?: string;
  contactTitle?: string;
  contactQuote?: string;
  extractionMethod?: "ai" | "heuristic" | "hybrid";
  orgType?: string;
  sourceSignalTier?: string;
};

async function filterCompaniesWithAi(
  companies: ExtractCompanyRow[],
  extractCtx: { industries: string[]; keywords: string[] },
): Promise<ExtractCompanyRow[]> {
  if (companies.length === 0) return companies;

  const cap = Math.min(companies.length, 300);
  const slice = companies.slice(0, cap);

  try {
    const payload = slice.map((c, index) => ({
      index,
      companyName: c.companyName,
      role: c.role,
      quote: c.quote.slice(0, 120),
      presence: c.presence,
    }));

    const ai = await callOpenAiJson<CompanyFilterOutput>({
      system: `${AI_GUARDRAILS}\nFilter extracted event companies for B2B field-sales relevance. Keep commercial orgs aligned to the seller ICP. Drop academic labs/departments, generic university entries, and duplicate subsidiaries unless they are clearly sponsors/exhibitors with strong quotes. Tier1 CRM matches are not available here — use org type and GTM relevance.`,
      user: [
        `Seller ICP industries: ${extractCtx.industries.join(", ") || "unknown"}`,
        `Seller keywords: ${extractCtx.keywords.join(", ") || "unknown"}`,
        `\nCompanies (JSON):\n${JSON.stringify(payload)}`,
      ].join("\n"),
      responseSchema: companyFilterSchema,
    });

    if (!ai?.companies?.length) return slice;

    const decisionByIndex = new Map(ai.companies.map((r) => [r.index, r]));
    const kept: ExtractCompanyRow[] = [];

    for (let i = 0; i < slice.length; i++) {
      const row = slice[i]!;
      const decision = decisionByIndex.get(i);
      if (!decision) {
        kept.push(row);
        continue;
      }
      if (!decision.keep) continue;

      kept.push({
        ...row,
        orgType: decision.orgType,
        confidence:
          decision.gtmRelevance < 0.4
            ? row.confidence * 0.5
            : row.confidence,
      });
    }

    console.log(
      `Silver filter: ${slice.length} → ${kept.length} companies kept`,
    );
    return kept.length > 0 ? kept : slice;
  } catch (err) {
    console.warn("Company filter pass failed, keeping all", err);
    return slice;
  }
}

async function runAiMemo(
  ctx: ActionCtx,
  eventId: Id<"event">,
  runIntent?: {
    objective?: string;
    participationOptions?: string[];
    repCount?: number;
  },
  warmCache?: boolean,
): Promise<Id<"decisionMemo"> | null> {
  try {
    const inputs = await ctx.runQuery(internal.memo.getInputs, { eventId });
    if (!inputs) return null;

    if (warmCache) {
      await ctx.runMutation(internal.memo.markRunning, {
        eventId,
        message: "Drafting memo (cached replay)…",
      });
    }

    const ai = await callOpenAiJson<DecisionMemoOutput>({
      system: `${AI_GUARDRAILS}\nYou are Schrute, a blunt GTM analyst for construction and industrial field sales. Write a go/no-go memo for whether a B2B team should spend on this event. Be concise and decisive. Address how to show up: attend (send reps), sponsor, speak, or exhibit (booth) when the user's participation options are provided. citationQuotes MUST be copied verbatim from the evidence quotes provided — never invent quotes. Align verdict with the underwriting recommendation unless the evidence clearly contradicts it.`,
      user: buildMemoPrompt(inputs, runIntent),
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

type RunIntentInput = {
  objective?: string;
  participationOptions?: string[];
  repCount?: number;
};

function buildMemoPrompt(
  inputs: MemoInputs,
  runIntent?: RunIntentInput,
): string {
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

  const intentLines: string[] = [];
  if (runIntent?.objective) {
    intentLines.push(`User objective: ${runIntent.objective}`);
  }
  if (runIntent?.participationOptions?.length) {
    intentLines.push(
      `Participation options under review: ${runIntent.participationOptions.join(", ")}`,
    );
  }
  if (runIntent?.repCount != null && runIntent.repCount > 0) {
    intentLines.push(`Reps available to send: ${runIntent.repCount}`);
  }

  return [
    `Event: ${event.name}${event.location ? ` (${event.location})` : ""}`,
    `Underwriting recommendation: ${score.recommendation}`,
    `Economics: all-in cost ${usd(score.totalEventCost)}, needs ${score.requiredQualifiedMeetings} qualified meetings to break even, spend cap ${usd(score.sponsorCap)}.`,
    `Matched pipeline value: ${usd(score.matchedPipelineValue)}. Tier-1 CRM accounts present: ${score.tier1MatchCount}. Tier-2 net-new ICP: ${score.tier2MatchCount}.`,
    ...(intentLines.length > 0
      ? ["", "User context:", ...intentLines.map((l) => `- ${l}`)]
      : []),
    "",
    "Matched accounts and their evidence quotes (use these for citationQuotes):",
    matchLines || "- (no matched accounts)",
  ].join("\n");
}
