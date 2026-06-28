import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { upsertJob } from "./lib/jobs";
import { fuzzyNameScore } from "./lib/normalize";
import { callOpenAiJson, callOpenAiWebSearch } from "./lib/openai";
import { hasFiber, revealContact } from "./lib/fiber";
import {
  attendeeSearchSchema,
  attendeeReasonsSchema,
  speakerExtractionSchema,
  type AttendeeSearchOutput,
  type AttendeeReasonsOutput,
  type SpeakerExtractionOutput,
} from "../lib/aiSchemas";

const MAX_FIBER_REVEALS = 12;

type EnrichResult = { attendeeCount: number; contactCount: number };

const runIntentValidator = v.optional(
  v.object({
    objective: v.optional(v.string()),
    participationOptions: v.optional(v.array(v.string())),
    repCount: v.optional(v.number()),
  }),
);

/**
 * Enrichment sidecar: discover prospective attendees from public posts via
 * OpenAI web search, then reveal real contact details with Fiber. Entirely
 * best-effort — any failure marks the step skipped, never failing the run.
 */
export const run = internalAction({
  args: {
    eventId: v.id("event"),
    runIntent: runIntentValidator,
  },
  returns: v.object({ attendeeCount: v.number(), contactCount: v.number() }),
  handler: async (ctx, args): Promise<EnrichResult> => {
    await ctx.runMutation(internal.enrich.markStatus, {
      eventId: args.eventId,
      status: "running",
      message: "Searching public posts for attendees",
      progress: 15,
    });

    try {
      const inputs = await ctx.runQuery(internal.enrich.getInputs, {
        eventId: args.eventId,
      });
      if (!inputs) {
        await ctx.runMutation(internal.enrich.markStatus, {
          eventId: args.eventId,
          status: "skipped",
          message: "Event not found",
          progress: 100,
        });
        return { attendeeCount: 0, contactCount: 0 };
      }

      // Always run discovery: public posts (web search) + corpus speakers,
      // seeded with the ICP and any matched companies. Both degrade gracefully.
      const [posted, speakers] = await Promise.all([
        discoverAttendees(inputs),
        gatherCorpusSpeakers(inputs),
      ]);

      // Merge, deduping by name (web-post signal wins over a bare speaker row).
      const byName = new Map<string, DiscoveredAttendee>();
      for (const s of speakers) byName.set(s.fullName.toLowerCase(), s);
      for (const p of posted) byName.set(p.fullName.toLowerCase(), p);
      const attendees = Array.from(byName.values());

      if (attendees.length === 0) {
        await ctx.runMutation(internal.enrich.markStatus, {
          eventId: args.eventId,
          status: "skipped",
          message: "No public attendance signals found yet",
          progress: 100,
        });
        return { attendeeCount: 0, contactCount: 0 };
      }

      // Map each attendee to a matched account by fuzzy company name.
      const mapped = attendees.map((a) => {
        const best = bestMatch(a.companyName, inputs.matches);
        return {
          attendee: a,
          accountMatchId: best?._id,
          matchTier: best?.tier,
        };
      });

      // Reveal real contact details for EVERY LinkedIn-backed attendee (not
      // just matched accounts), in parallel, capped to keep latency bounded.
      // Keyed by profile URL so we can fold enrichment back onto each person.
      const revealedByUrl = new Map<
        string,
        {
          email?: string;
          emailStatus?: string;
          phone?: string;
          location?: string;
          title?: string;
          raw: string;
        }
      >();

      if (hasFiber()) {
        const revealTargets = mapped
          .filter(
            (m) =>
              m.attendee.network === "linkedin" &&
              m.attendee.profileUrl &&
              /linkedin\.com\/in\//i.test(m.attendee.profileUrl),
          )
          // Matched accounts first, then by confidence.
          .sort((a, b) => {
            const am = a.accountMatchId ? 0 : 1;
            const bm = b.accountMatchId ? 0 : 1;
            if (am !== bm) return am - bm;
            return b.attendee.confidence - a.attendee.confidence;
          })
          .slice(0, MAX_FIBER_REVEALS);

        await ctx.runMutation(internal.enrich.markStatus, {
          eventId: args.eventId,
          status: "running",
          message: `Revealing contacts via Fiber (${revealTargets.length})`,
          progress: 65,
        });

        const revealed = await Promise.all(
          revealTargets.map(async (m) => ({
            url: m.attendee.profileUrl,
            data: await revealContact(m.attendee.profileUrl),
          })),
        );
        for (const r of revealed) {
          if (r.data) revealedByUrl.set(r.url, r.data);
        }
      }

      // Generate one short, grounded "why a good match" line per attendee.
      const reasonByIndex = await generateMatchReasons(inputs, mapped);

      // Contacts table (for matched accounts) — keeps existing behavior.
      const contacts: Array<{
        accountMatchId: Id<"accountMatch">;
        fullName: string;
        title: string;
        email?: string;
        phone?: string;
        linkedinUrl?: string;
        verification: "verified" | "likely" | "unknown";
        fiberRawJson?: string;
      }> = [];
      for (const m of mapped) {
        if (!m.accountMatchId) continue;
        const revealed = m.attendee.profileUrl
          ? revealedByUrl.get(m.attendee.profileUrl)
          : undefined;
        if (!revealed) continue;
        contacts.push({
          accountMatchId: m.accountMatchId,
          fullName: m.attendee.fullName,
          title: m.attendee.title,
          email: revealed.email,
          phone: revealed.phone,
          linkedinUrl: m.attendee.profileUrl,
          verification: revealed.emailStatus === "valid" ? "verified" : "likely",
          fiberRawJson: revealed.raw,
        });
      }

      const result: EnrichResult = await ctx.runMutation(internal.enrich.save, {
        eventId: args.eventId,
        attendees: mapped.map((m, i) => {
          const revealed = m.attendee.profileUrl
            ? revealedByUrl.get(m.attendee.profileUrl)
            : undefined;
          return {
            accountMatchId: m.accountMatchId,
            matchTier: m.matchTier,
            fullName: m.attendee.fullName,
            title: m.attendee.title,
            companyName: m.attendee.companyName,
            network: m.attendee.network,
            postQuote: m.attendee.postQuote,
            postedAt: m.attendee.postedAt || undefined,
            confidence: m.attendee.confidence,
            profileUrl: m.attendee.profileUrl || undefined,
            sourceUrl: m.attendee.sourceUrl || undefined,
            email: revealed?.email,
            emailStatus: revealed?.emailStatus,
            phone: revealed?.phone,
            location: revealed?.location,
            enrichedTitle: revealed?.title,
            matchReason: reasonByIndex.get(i),
          };
        }),
        contacts,
      });

      return result;
    } catch (err) {
      console.error("Enrichment failed", err);
      await ctx.runMutation(internal.enrich.markStatus, {
        eventId: args.eventId,
        status: "skipped",
        message: "Enrichment unavailable — showing demo signals",
        progress: 100,
      });
      return { attendeeCount: 0, contactCount: 0 };
    }
  },
});

type DiscoveredAttendee = {
  fullName: string;
  title: string;
  companyName: string;
  network: "linkedin" | "x" | "web";
  postQuote: string;
  postedAt: string;
  profileUrl: string;
  sourceUrl: string;
  confidence: number;
};

type EnrichInputs = {
  event: { name: string; location: string | null; dates: string | null };
  buyerTitles: string[];
  industries: string[];
  speakerDocs: Array<{ url: string | null; text: string }>;
  matches: Array<{
    _id: Id<"accountMatch">;
    companyName: string;
    tier: "tier1_crm" | "tier2_icp";
  }>;
};

async function discoverAttendees(
  inputs: EnrichInputs,
): Promise<DiscoveredAttendee[]> {
  const companyList = inputs.matches
    .slice(0, 25)
    .map((m) => m.companyName)
    .join(", ");

  const ai = await callOpenAiWebSearch<AttendeeSearchOutput>({
    instructions: [
      "You are a B2B field-sales researcher.",
      "Use web search to find PEOPLE who have PUBLICLY posted on LinkedIn or X/Twitter that they are attending, speaking at, exhibiting at, or visiting the named event.",
      "Return every real, sourced person you can find — they do NOT need to work at a target company.",
      "When someone works at one of the provided target companies or industries, that is a stronger signal: give it higher confidence.",
      "Every result MUST include a verbatim quote from the public post and, when available, the profile/post URL. Never invent a person, a quote, or a URL.",
    ].join(" "),
    input: [
      `Event: ${inputs.event.name}`,
      inputs.event.location ? `Location: ${inputs.event.location}` : "",
      inputs.event.dates ? `Dates: ${inputs.event.dates}` : "",
      companyList
        ? `Target companies (boost confidence if matched): ${companyList}`
        : "",
      inputs.industries.length
        ? `Buyer industries (ICP): ${inputs.industries.slice(0, 8).join(", ")}`
        : "",
      inputs.buyerTitles.length
        ? `Relevant buyer titles: ${inputs.buyerTitles.slice(0, 8).join(", ")}`
        : "",
      "Find up to 12 people with public posts about attending this event. Prioritize the target companies and ICP industries, then fill with other credible public attendees.",
    ]
      .filter(Boolean)
      .join("\n"),
    responseSchema: attendeeSearchSchema,
  });

  const people = ai?.people ?? [];
  return people
    .filter((p) => p.fullName?.trim() && p.postQuote?.trim())
    .map((p) => ({
      fullName: p.fullName.trim(),
      title: p.title?.trim() || "unknown",
      companyName: p.companyName?.trim() || "unknown",
      network: p.network === "x" ? ("x" as const) : ("linkedin" as const),
      postQuote: p.postQuote.trim(),
      postedAt: p.postedAt?.trim() ?? "",
      profileUrl: p.profileUrl?.trim() ?? "",
      sourceUrl: p.sourceUrl?.trim() ?? "",
      confidence:
        typeof p.confidence === "number"
          ? Math.max(0, Math.min(1, p.confidence))
          : 0.5,
    }));
}

/**
 * Extract named speakers/keynotes from gathered program/speaker pages as
 * high-confidence, citation-backed attendees (network = "web").
 */
async function gatherCorpusSpeakers(
  inputs: EnrichInputs,
): Promise<DiscoveredAttendee[]> {
  if (inputs.speakerDocs.length === 0) return [];

  const corpus = inputs.speakerDocs
    .map((d) => d.text)
    .join("\n\n")
    .slice(0, 12_000);
  if (corpus.length < 200) return [];

  const sourceUrl = inputs.speakerDocs.find((d) => d.url)?.url ?? "";

  const ai = await callOpenAiJson<SpeakerExtractionOutput>({
    system:
      "Extract people named as speakers, keynotes, panelists, or committee members in the source. Copy a verbatim line as proof. Never invent a person.",
    user: `Event: ${inputs.event.name}\n\nSource text:\n${corpus}`,
    responseSchema: speakerExtractionSchema,
  });

  const speakers = ai?.speakers ?? [];
  return speakers
    .filter((s) => s.fullName?.trim() && s.quote?.trim())
    .map((s) => ({
      fullName: s.fullName.trim(),
      title: s.title?.trim() || "Speaker",
      companyName: s.companyName?.trim() || "unknown",
      network: "web" as const,
      postQuote: s.quote.trim(),
      postedAt: "",
      profileUrl: "",
      sourceUrl,
      confidence: 0.85,
    }));
}

type MappedAttendee = {
  attendee: DiscoveredAttendee;
  accountMatchId?: Id<"accountMatch">;
  matchTier?: "tier1_crm" | "tier2_icp";
};

/**
 * One concise, grounded "why a good match" line per attendee, returned as a
 * map of input index -> reason. Best-effort: returns an empty map on failure.
 */
async function generateMatchReasons(
  inputs: EnrichInputs,
  mapped: MappedAttendee[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (mapped.length === 0) return out;

  const people = mapped.map((m, i) => ({
    index: i,
    name: m.attendee.fullName,
    title: m.attendee.title,
    company: m.attendee.companyName,
    inPipeline: m.matchTier === "tier1_crm",
    icpFit: m.matchTier === "tier2_icp",
    matchTier: m.matchTier ?? "none",
  }));

  try {
    const ai = await callOpenAiJson<AttendeeReasonsOutput>({
      system: [
        "You help a B2B field-sales team decide who to meet at an event.",
        "For each person, write ONE concise sentence (max ~20 words) on why they're a good person to meet, grounded in their role/company and the seller's ICP.",
        "Only say someone is 'in your pipeline' when inPipeline is true. If icpFit is true (but not inPipeline), describe them as an ICP-fit / net-new prospect — do NOT claim they are in the pipeline. Never invent facts; keep it specific and useful.",
      ].join(" "),
      user: [
        `Seller ICP industries: ${inputs.industries.slice(0, 8).join(", ") || "unknown"}`,
        `Seller target buyer titles: ${inputs.buyerTitles.slice(0, 8).join(", ") || "unknown"}`,
        `Event: ${inputs.event.name}`,
        "",
        "People (JSON):",
        JSON.stringify(people),
      ].join("\n"),
      responseSchema: attendeeReasonsSchema,
    });

    for (const r of ai?.reasons ?? []) {
      if (
        typeof r.index === "number" &&
        r.index >= 0 &&
        r.index < mapped.length &&
        r.reason?.trim()
      ) {
        out.set(r.index, r.reason.trim());
      }
    }
  } catch (err) {
    console.warn("Attendee reason generation failed", err);
  }
  return out;
}

function bestMatch(
  companyName: string,
  matches: EnrichInputs["matches"],
): EnrichInputs["matches"][number] | undefined {
  let best: EnrichInputs["matches"][number] | undefined;
  let bestScore = 0;
  for (const m of matches) {
    const score = fuzzyNameScore(companyName, m.companyName);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

export const getInputs = internalQuery({
  args: { eventId: v.id("event") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get("event", args.eventId);
    if (!event) return null;

    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    let buyerTitles: string[] = [];
    let industries: string[] = [];
    if (event.revenueProfileId) {
      const profile = await ctx.db.get("revenueProfile", event.revenueProfileId);
      buyerTitles = profile?.buyerTitles ?? [];
      industries = profile?.industries ?? [];
    }

    // Speaker/program pages gathered during research — used to surface named
    // speakers as sourced attendees (independent of social posts).
    const docs = await ctx.db
      .query("sourceDocument")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const speakerDocs = docs
      .filter(
        (d) => d.category === "speakers" || d.category === "program",
      )
      .map((d) => ({ url: d.url ?? null, text: d.textContent }));

    const dates =
      event.startDate && event.endDate
        ? `${event.startDate} to ${event.endDate}`
        : (event.startDate ?? null);

    return {
      event: { name: event.name, location: event.location ?? null, dates },
      buyerTitles,
      industries,
      speakerDocs,
      matches: matches.map((m) => ({
        _id: m._id,
        companyName: m.companyName,
        tier: m.tier,
      })),
    };
  },
});

export const markStatus = internalMutation({
  args: {
    eventId: v.id("event"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    message: v.optional(v.string()),
    progress: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertJob(ctx, args.eventId, "enrich", {
      status: args.status,
      message: args.message,
      progress: args.progress,
    });
    return null;
  },
});

export const save = internalMutation({
  args: {
    eventId: v.id("event"),
    attendees: v.array(
      v.object({
        accountMatchId: v.optional(v.id("accountMatch")),
        matchTier: v.optional(
          v.union(v.literal("tier1_crm"), v.literal("tier2_icp")),
        ),
        fullName: v.string(),
        title: v.string(),
        companyName: v.string(),
        network: v.union(
          v.literal("linkedin"),
          v.literal("x"),
          v.literal("web"),
        ),
        postQuote: v.string(),
        postedAt: v.optional(v.string()),
        confidence: v.number(),
        profileUrl: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        email: v.optional(v.string()),
        emailStatus: v.optional(v.string()),
        phone: v.optional(v.string()),
        location: v.optional(v.string()),
        enrichedTitle: v.optional(v.string()),
        matchReason: v.optional(v.string()),
      }),
    ),
    contacts: v.array(
      v.object({
        accountMatchId: v.id("accountMatch"),
        fullName: v.string(),
        title: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        linkedinUrl: v.optional(v.string()),
        verification: v.union(
          v.literal("verified"),
          v.literal("likely"),
          v.literal("unknown"),
        ),
        fiberRawJson: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ attendeeCount: v.number(), contactCount: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Replace any prior enrichment for this event (idempotent re-runs).
    const priorAttendees = await ctx.db
      .query("eventAttendee")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of priorAttendees) {
      await ctx.db.delete("eventAttendee", row._id);
    }
    const priorContacts = await ctx.db
      .query("contact")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of priorContacts) {
      await ctx.db.delete("contact", row._id);
    }

    for (const a of args.attendees) {
      await ctx.db.insert("eventAttendee", {
        eventId: args.eventId,
        accountMatchId: a.accountMatchId,
        fullName: a.fullName,
        title: a.title,
        companyName: a.companyName,
        matchTier: a.matchTier,
        network: a.network,
        postQuote: a.postQuote,
        postedAt: a.postedAt,
        confidence: a.confidence,
        profileUrl: a.profileUrl,
        sourceUrl: a.sourceUrl,
        email: a.email,
        emailStatus: a.emailStatus,
        phone: a.phone,
        location: a.location,
        enrichedTitle: a.enrichedTitle,
        matchReason: a.matchReason,
        createdAt: now,
      });
    }

    for (const c of args.contacts) {
      await ctx.db.insert("contact", {
        accountMatchId: c.accountMatchId,
        eventId: args.eventId,
        fullName: c.fullName,
        title: c.title,
        email: c.email,
        phone: c.phone,
        linkedinUrl: c.linkedinUrl,
        verification: c.verification,
        fiberRawJson: c.fiberRawJson,
        createdAt: now,
      });
    }

    await upsertJob(ctx, args.eventId, "enrich", {
      status: "completed",
      message: `${args.attendees.length} attendees · ${args.contacts.length} contacts`,
      progress: 100,
    });

    return {
      attendeeCount: args.attendees.length,
      contactCount: args.contacts.length,
    };
  },
});
