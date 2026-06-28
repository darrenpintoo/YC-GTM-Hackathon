import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { upsertJob } from "./lib/jobs";
import { fuzzyNameScore } from "./lib/normalize";
import { callOpenAiJson, callOpenAiWebSearch } from "./lib/openai";
import { hasFiber, revealContact } from "./lib/fiber";
import {
  accountMeetingReasonsSchema,
  attendeeSearchSchema,
  attendeeReasonsSchema,
  decisionMakerSearchSchema,
  speakerExtractionSchema,
  type AccountMeetingReasonsOutput,
  type AttendeeSearchOutput,
  type AttendeeReasonsOutput,
  type DecisionMakerSearchOutput,
  type SpeakerExtractionOutput,
} from "../lib/aiSchemas";
import { resolveMatchReason } from "./lib/attendeeConnection";
import {
  resolveAccountMeetingReason,
} from "../lib/accountMeetingReason";

const MAX_FIBER_REVEALS = 12;
const MAX_FIBER_DECISION_MAKERS = 12;
const MAX_TIER2_DM = 20;

type ContactPayload = {
  accountMatchId: Id<"accountMatch">;
  fullName: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  verification: "verified" | "likely" | "unknown";
  fiberRawJson?: string;
};

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
    warmCache: v.optional(v.boolean()),
  },
  returns: v.object({ attendeeCount: v.number(), contactCount: v.number() }),
  handler: async (ctx, args): Promise<EnrichResult> => {
    await ctx.runMutation(internal.enrich.markStatus, {
      eventId: args.eventId,
      status: "running",
      message: args.warmCache
        ? "Searching public posts (cached replay)"
        : "Searching public posts for attendees",
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

      // Source-named contacts from extraction (speaker pages, bios).
      const contactByMatch = new Map<Id<"accountMatch">, ContactPayload>();
      for (const m of inputs.matches) {
        if (!m.contactName?.trim()) continue;
        upsertContact(contactByMatch, {
          accountMatchId: m._id,
          fullName: m.contactName.trim(),
          title: m.contactTitle?.trim() || "Decision maker",
          verification: "likely",
          fiberRawJson: m.contactQuote
            ? JSON.stringify({ sourceQuote: m.contactQuote })
            : undefined,
        });
      }

      // Public posts + corpus speakers (best-effort).
      const [posted, speakers] = await Promise.all([
        discoverAttendees(inputs),
        gatherCorpusSpeakers(inputs),
      ]);

      const byName = new Map<string, DiscoveredAttendee>();
      for (const s of speakers) byName.set(s.fullName.toLowerCase(), s);
      for (const p of posted) byName.set(p.fullName.toLowerCase(), p);
      for (const s of tier1ContactsFromMatches(inputs)) {
        if (!byName.has(s.fullName.toLowerCase())) {
          byName.set(s.fullName.toLowerCase(), s);
        }
      }
      const attendees = Array.from(byName.values());

      const mapped = attendees.map((a) => {
        const best = bestMatch(a.companyName, inputs.matches);
        return {
          attendee: a,
          accountMatchId: best?._id,
          matchTier: best?.tier,
          matchedOppValue: best?.matchedOppValue,
        };
      });

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
          .sort((a, b) => {
            const am = a.accountMatchId ? 0 : 1;
            const bm = b.accountMatchId ? 0 : 1;
            if (am !== bm) return am - bm;
            return b.attendee.confidence - a.attendee.confidence;
          })
          .slice(0, MAX_FIBER_REVEALS);

        if (revealTargets.length > 0) {
          await ctx.runMutation(internal.enrich.markStatus, {
            eventId: args.eventId,
            status: "running",
            message: args.warmCache
              ? `Revealing attendee contacts (cached Fiber, ${revealTargets.length})`
              : `Revealing attendee contacts (${revealTargets.length})`,
            progress: 55,
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
      }

      for (const m of mapped) {
        if (!m.accountMatchId) continue;
        const revealed = m.attendee.profileUrl
          ? revealedByUrl.get(m.attendee.profileUrl)
          : undefined;
        if (!revealed) continue;
        upsertContact(contactByMatch, {
          accountMatchId: m.accountMatchId,
          fullName: m.attendee.fullName,
          title: m.attendee.title,
          email: revealed.email,
          phone: revealed.phone,
          linkedinUrl: m.attendee.profileUrl,
          verification:
            revealed.emailStatus === "valid" ? "verified" : "likely",
          fiberRawJson: revealed.raw,
        });
      }

      // Decision makers for CRM + top ICP accounts (web search + Fiber).
      await ctx.runMutation(internal.enrich.markStatus, {
        eventId: args.eventId,
        status: "running",
        message: "Finding decision makers at matched accounts",
        progress: 72,
      });
      const dmContacts = await discoverDecisionMakers(inputs);
      for (const c of dmContacts) upsertContact(contactByMatch, c);

      const reasonByIndex =
        mapped.length > 0
          ? await generateMatchReasons(inputs, mapped)
          : new Map<number, string>();

      const result: EnrichResult = await ctx.runMutation(internal.enrich.save, {
        eventId: args.eventId,
        attendees: mapped.map((m, i) => {
          const revealed = m.attendee.profileUrl
            ? revealedByUrl.get(m.attendee.profileUrl)
            : undefined;
          const displayTitle = revealed?.title || m.attendee.title;
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
            matchReason: resolveMatchReason(reasonByIndex.get(i), {
              eventName: inputs.event.name,
              sellerName: inputs.sellerName,
              buyerTitles: inputs.buyerTitles,
              industries: inputs.industries,
              matchTier: m.matchTier,
              matchedOppValue: m.matchedOppValue,
              network: m.attendee.network,
              postQuote: m.attendee.postQuote,
              fullName: m.attendee.fullName,
              title: displayTitle,
              companyName: m.attendee.companyName,
            }),
          };
        }),
        contacts: Array.from(contactByMatch.values()),
      });

      await ctx.runMutation(internal.enrich.markStatus, {
        eventId: args.eventId,
        status: "completed",
        message: `${result.attendeeCount} attendees · ${result.contactCount} contacts`,
        progress: 100,
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
  sellerName?: string;
  buyerTitles: string[];
  industries: string[];
  speakerDocs: Array<{ url: string | null; text: string }>;
  matches: Array<{
    _id: Id<"accountMatch">;
    companyName: string;
    domain?: string;
    tier: "tier1_crm" | "tier2_icp";
    fitScore: number;
    matchedOppValue?: number;
    contactName?: string;
    contactTitle?: string;
    contactQuote?: string;
  }>;
};

function contactScore(c: ContactPayload): number {
  let score = c.verification === "verified" ? 3 : c.verification === "likely" ? 1 : 0;
  if (c.email) score += 2;
  if (c.phone) score += 1;
  return score;
}

function upsertContact(
  map: Map<Id<"accountMatch">, ContactPayload>,
  contact: ContactPayload,
) {
  const existing = map.get(contact.accountMatchId);
  if (!existing || contactScore(contact) > contactScore(existing)) {
    map.set(contact.accountMatchId, contact);
  }
}

/** Web search + Fiber for tier1 CRM and top tier2 ICP accounts. */
async function discoverDecisionMakers(
  inputs: EnrichInputs,
): Promise<ContactPayload[]> {
  const tier1 = inputs.matches.filter((m) => m.tier === "tier1_crm");
  const tier2 = inputs.matches
    .filter((m) => m.tier === "tier2_icp")
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, MAX_TIER2_DM);
  const targets = [...tier1, ...tier2];
  if (targets.length === 0) return [];

  const companies = targets.map((m, index) => ({
    index,
    companyName: m.companyName,
    domain: m.domain ?? "",
    hasSourceContact: Boolean(m.contactName),
  }));

  try {
    const ai = await callOpenAiWebSearch<DecisionMakerSearchOutput>({
      instructions: [
        "You are a B2B sales researcher.",
        "For each company, use web search to find ONE public LinkedIn profile of a likely decision maker matching the seller's buyer titles.",
        "Return real linkedin.com/in/ URLs only — never invent a person or URL.",
        "If no credible profile is found, return empty strings for that index.",
      ].join(" "),
      input: [
        `Event context: ${inputs.event.name}`,
        `Target buyer titles: ${inputs.buyerTitles.slice(0, 8).join(", ") || "VP, Director"}`,
        `Companies (JSON): ${JSON.stringify(companies)}`,
      ].join("\n"),
      responseSchema: decisionMakerSearchSchema,
    });

    const people = (ai?.people ?? []).filter(
      (p) =>
        typeof p.index === "number" &&
        p.index >= 0 &&
        p.index < targets.length &&
        p.linkedinUrl?.includes("linkedin.com/in/"),
    );

    const toReveal = people.slice(0, MAX_FIBER_DECISION_MAKERS);
    const revealed = await Promise.all(
      toReveal.map(async (person) => {
        const target = targets[person.index]!;
        const fiber =
          hasFiber() && person.linkedinUrl
            ? await revealContact(person.linkedinUrl)
            : null;
        return { target, person, fiber };
      }),
    );

    const out: ContactPayload[] = [];
    for (const row of revealed) {
      const name = row.person.fullName?.trim();
      if (!name && !row.fiber?.email) continue;
      out.push({
        accountMatchId: row.target._id,
        fullName: name || "Decision maker",
        title:
          row.person.title?.trim() ||
          row.fiber?.title ||
          inputs.buyerTitles[0] ||
          "Decision maker",
        email: row.fiber?.email,
        phone: row.fiber?.phone,
        linkedinUrl: row.person.linkedinUrl || undefined,
        verification:
          row.fiber?.emailStatus === "valid" ? "verified" : "likely",
        fiberRawJson: row.fiber?.raw,
      });
    }
    return out;
  } catch (err) {
    console.warn("Decision maker discovery failed", err);
    return [];
  }
}

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
  matchedOppValue?: number;
};

/** Surface tier-1 named speakers from extraction in the People tab. */
function tier1ContactsFromMatches(inputs: EnrichInputs): DiscoveredAttendee[] {
  const out: DiscoveredAttendee[] = [];
  for (const m of inputs.matches) {
    if (m.tier !== "tier1_crm" || !m.contactName?.trim()) continue;
    const title = m.contactTitle?.trim() || "Speaker";
    const quote =
      m.contactQuote?.trim() ||
      `${m.contactName.trim()} listed as ${title} at ${inputs.event.name}.`;
    out.push({
      fullName: m.contactName.trim(),
      title,
      companyName: m.companyName,
      network: "web",
      postQuote: quote,
      postedAt: "",
      profileUrl: "",
      sourceUrl: "",
      confidence: 0.92,
    });
  }
  return out;
}

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
    openPipelineUsd: m.matchedOppValue ?? 0,
    network: m.attendee.network,
    publicSignal: m.attendee.postQuote.slice(0, 200),
  }));

  try {
    const ai = await callOpenAiJson<AttendeeReasonsOutput>({
      system: [
        `You help ${inputs.sellerName ?? "a B2B sales team"} decide who to meet at ${inputs.event.name}.`,
        "For each person, write ONE actionable sentence (max ~22 words) explaining WHY meet them AT THIS EVENT — not their job description.",
        "Ground every line in publicSignal (their post or program listing) and/or inPipeline / icpFit.",
        "GOOD: 'Posted about attending ICRA — CRM account with $220K open; book before sessions fill.'",
        "BAD: 'Works at Amazon Robotics in robotics.' / 'Valuable contact for collaboration.'",
        "If inPipeline is true, you may mention pipeline. Never claim pipeline when icpFit alone.",
        "Never invent facts not in the input.",
      ].join(" "),
      user: [
        `Seller: ${inputs.sellerName ?? "unknown"}`,
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
    let sellerName: string | undefined;
    if (event.revenueProfileId) {
      const profile = await ctx.db.get("revenueProfile", event.revenueProfileId);
      buyerTitles = profile?.buyerTitles ?? [];
      industries = profile?.industries ?? [];
      sellerName = profile?.name;
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
      sellerName,
      buyerTitles,
      industries,
      speakerDocs,
      matches: matches.map((m) => ({
        _id: m._id,
        companyName: m.companyName,
        domain: m.domain,
        tier: m.tier,
        fitScore: m.fitScore,
        matchedOppValue: m.matchedOppValue,
        contactName: m.contactName,
        contactTitle: m.contactTitle,
        contactQuote: m.contactQuote,
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

/** Best-effort AI "why meet" lines for all matched accounts (after match step). */
export const generateMeetingReasons = internalAction({
  args: { eventId: v.id("event") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inputs = await ctx.runQuery(internal.enrich.getInputs, {
      eventId: args.eventId,
    });
    if (!inputs || inputs.matches.length === 0) return null;

    const fullMatches = await ctx.runQuery(internal.enrich.listMatchesForReasons, {
      eventId: args.eventId,
    });

    const accounts = fullMatches.map((m, index) => ({
      index,
      companyName: m.companyName,
      tier: m.tier,
      role: m.role,
      openPipelineUsd: m.matchedOppValue ?? 0,
      boothOrSession: m.boothOrSession ?? "",
      publicSignal: (m.evidenceQuote ?? "").slice(0, 200),
      namedContact: m.contactName ?? "",
    }));

    const patches: Array<{ matchId: Id<"accountMatch">; reason: string }> = [];

    try {
      const ai = await callOpenAiJson<AccountMeetingReasonsOutput>({
        system: [
          `You help ${inputs.sellerName ?? "a B2B sales team"} decide which companies to meet at ${inputs.event.name}.`,
          "For each account, write ONE actionable sentence (max ~22 words) on WHY meet them AT THIS EVENT — not their industry overview.",
          "Ground every line in publicSignal and/or openPipelineUsd / tier.",
          "GOOD: 'CRM account with $180K open opp; exhibiting Booth N1234 — walk the floor before renewal.'",
          "BAD: 'Leading construction firm.' / 'Good fit for collaboration.'",
          "For sponsorship listings (not company names), say to deprioritize unless ICP-aligned.",
          "Never invent facts not in the input.",
        ].join(" "),
        user: [
          `Seller ICP industries: ${inputs.industries.slice(0, 8).join(", ") || "unknown"}`,
          `Seller target buyer titles: ${inputs.buyerTitles.slice(0, 8).join(", ") || "unknown"}`,
          `Event: ${inputs.event.name}`,
          "",
          "Accounts (JSON):",
          JSON.stringify(accounts.slice(0, 80)),
        ].join("\n"),
        responseSchema: accountMeetingReasonsSchema,
      });

      for (const r of ai?.reasons ?? []) {
        if (
          typeof r.index !== "number" ||
          r.index < 0 ||
          r.index >= fullMatches.length ||
          !r.reason?.trim()
        ) {
          continue;
        }
        const m = fullMatches[r.index]!;
        const ctxReason = {
          eventName: inputs.event.name,
          sellerName: inputs.sellerName,
          buyerTitles: inputs.buyerTitles,
          companyName: m.companyName,
          domain: m.domain,
          tier: m.tier,
          role: m.role,
          boothOrSession: m.boothOrSession,
          matchedOppValue: m.matchedOppValue,
          contactName: m.contactName,
          contactTitle: m.contactTitle,
          evidenceQuote: m.evidenceQuote,
          presence: m.presence,
          editionLabel: m.editionLabel,
        };
        patches.push({
          matchId: m._id,
          reason: resolveAccountMeetingReason(r.reason.trim(), ctxReason),
        });
      }
    } catch (err) {
      console.warn("Account meeting reason generation failed", err);
    }

    if (patches.length > 0) {
      await ctx.runMutation(internal.enrich.patchMeetingReasons, { patches });
    }
    return null;
  },
});

export const listMatchesForReasons = internalQuery({
  args: { eventId: v.id("event") },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("accountMatch")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return matches.map((m) => ({
      _id: m._id,
      companyName: m.companyName,
      domain: m.domain,
      tier: m.tier,
      role: m.role,
      boothOrSession: m.boothOrSession,
      matchedOppValue: m.matchedOppValue,
      contactName: m.contactName,
      contactTitle: m.contactTitle,
      evidenceQuote: m.evidence[0]?.quote,
      presence: m.presence,
      editionLabel: m.editionLabel,
    }));
  },
});

export const patchMeetingReasons = internalMutation({
  args: {
    patches: v.array(
      v.object({
        matchId: v.id("accountMatch"),
        reason: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const p of args.patches) {
      await ctx.db.patch("accountMatch", p.matchId, {
        meetingReason: p.reason,
      });
    }
    return null;
  },
});

export const getMatchForEnrich = internalQuery({
  args: { accountMatchId: v.id("accountMatch") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get("accountMatch", args.accountMatchId);
    if (!match) return null;

    const event = await ctx.db.get("event", match.eventId);
    if (!event) return null;

    let buyerTitles: string[] = [];
    let sellerName: string | undefined;
    if (event.revenueProfileId) {
      const profile = await ctx.db.get("revenueProfile", event.revenueProfileId);
      buyerTitles = profile?.buyerTitles ?? [];
      sellerName = profile?.name;
    }

    const existingContact = await ctx.db
      .query("contact")
      .withIndex("by_account_match", (q) =>
        q.eq("accountMatchId", args.accountMatchId),
      )
      .first();

    return {
      match,
      eventName: event.name,
      sellerName,
      buyerTitles,
      existingContactId: existingContact?._id ?? null,
    };
  },
});

export const upsertContactForMatch = internalMutation({
  args: {
    accountMatchId: v.id("accountMatch"),
    eventId: v.id("event"),
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
  },
  returns: v.id("contact"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contact")
      .withIndex("by_account_match", (q) =>
        q.eq("accountMatchId", args.accountMatchId),
      )
      .first();

    if (existing) {
      await ctx.db.patch("contact", existing._id, {
        fullName: args.fullName,
        title: args.title,
        email: args.email,
        phone: args.phone,
        linkedinUrl: args.linkedinUrl,
        verification: args.verification,
        fiberRawJson: args.fiberRawJson,
      });
      return existing._id;
    }

    return await ctx.db.insert("contact", {
      accountMatchId: args.accountMatchId,
      eventId: args.eventId,
      fullName: args.fullName,
      title: args.title,
      email: args.email,
      phone: args.phone,
      linkedinUrl: args.linkedinUrl,
      verification: args.verification,
      fiberRawJson: args.fiberRawJson,
      createdAt: Date.now(),
    });
  },
});

export const upsertDraftForMatch = internalMutation({
  args: {
    accountMatchId: v.id("accountMatch"),
    eventId: v.id("event"),
    contactId: v.id("contact"),
    eventName: v.string(),
    companyName: v.string(),
    boothOrSession: v.optional(v.string()),
    contactFirstName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("outreachDraft")
      .withIndex("by_account_match", (q) =>
        q.eq("accountMatchId", args.accountMatchId),
      )
      .first();

    const booth = args.boothOrSession ? ` (${args.boothOrSession})` : "";
    const subject = `Meet at ${args.eventName}?`;
    const body = `Hi ${args.contactFirstName} — saw ${args.companyName} is on the floor at ${args.eventName}${booth}. I'd value 15 minutes while we're both there. Open to a quick coffee?`;

    if (existing) {
      await ctx.db.patch("outreachDraft", existing._id, {
        contactId: args.contactId,
        subject,
        body,
      });
      return null;
    }

    await ctx.db.insert("outreachDraft", {
      accountMatchId: args.accountMatchId,
      contactId: args.contactId,
      eventId: args.eventId,
      subject,
      body,
      tone: "direct",
      createdAt: Date.now(),
    });
    return null;
  },
});

/** On-demand decision-maker lookup when the user opens an account drawer. */
export const enrichAccountMatch = action({
  args: { accountMatchId: v.id("accountMatch") },
  returns: v.object({ found: v.boolean() }),
  handler: async (ctx, args): Promise<{ found: boolean }> => {
    const row = await ctx.runQuery(internal.enrich.getMatchForEnrich, {
      accountMatchId: args.accountMatchId,
    });
    if (!row) return { found: false };
    if (row.existingContactId) return { found: true };

    const { match, eventName, buyerTitles } = row;

    if (match.contactName?.trim()) {
      const contactId = await ctx.runMutation(internal.enrich.upsertContactForMatch, {
        accountMatchId: match._id,
        eventId: match.eventId,
        fullName: match.contactName.trim(),
        title: match.contactTitle?.trim() || "Decision maker",
        verification: "likely",
        fiberRawJson: match.contactQuote
          ? JSON.stringify({ sourceQuote: match.contactQuote })
          : undefined,
      });
      const first = match.contactName.trim().split(/\s+/)[0] ?? "there";
      await ctx.runMutation(internal.enrich.upsertDraftForMatch, {
        accountMatchId: match._id,
        eventId: match.eventId,
        contactId,
        eventName,
        companyName: match.companyName,
        boothOrSession: match.boothOrSession,
        contactFirstName: first,
      });
      return { found: true };
    }

    try {
      const ai = await callOpenAiWebSearch<DecisionMakerSearchOutput>({
        instructions: [
          "You are a B2B sales researcher.",
          "Use web search to find ONE public LinkedIn profile of a likely decision maker matching the seller's buyer titles.",
          "Return real linkedin.com/in/ URLs only — never invent a person or URL.",
          "If no credible profile is found, return empty strings.",
        ].join(" "),
        input: [
          `Event context: ${eventName}`,
          `Target buyer titles: ${buyerTitles.slice(0, 8).join(", ") || "VP, Director"}`,
          `Companies (JSON): ${JSON.stringify([
            {
              index: 0,
              companyName: match.companyName,
              domain: match.domain ?? "",
              hasSourceContact: false,
            },
          ])}`,
        ].join("\n"),
        responseSchema: decisionMakerSearchSchema,
      });

      const person = (ai?.people ?? []).find(
        (p) =>
          p.index === 0 &&
          p.linkedinUrl?.includes("linkedin.com/in/"),
      );

      if (!person?.linkedinUrl) return { found: false };

      const fiber =
        hasFiber() && person.linkedinUrl
          ? await revealContact(person.linkedinUrl)
          : null;

      const name = person.fullName?.trim();
      if (!name && !fiber?.email) return { found: false };

      const contactId = await ctx.runMutation(internal.enrich.upsertContactForMatch, {
        accountMatchId: match._id,
        eventId: match.eventId,
        fullName: name || "Decision maker",
        title:
          person.title?.trim() ||
          fiber?.title ||
          buyerTitles[0] ||
          "Decision maker",
        email: fiber?.email,
        phone: fiber?.phone,
        linkedinUrl: person.linkedinUrl || undefined,
        verification: fiber?.emailStatus === "valid" ? "verified" : "likely",
        fiberRawJson: fiber?.raw,
      });

      const first = (name || "there").split(/\s+/)[0] ?? "there";
      await ctx.runMutation(internal.enrich.upsertDraftForMatch, {
        accountMatchId: match._id,
        eventId: match.eventId,
        contactId,
        eventName,
        companyName: match.companyName,
        boothOrSession: match.boothOrSession,
        contactFirstName: first,
      });

      return { found: true };
    } catch (err) {
      console.warn("On-demand enrich failed", err);
      return { found: false };
    }
  },
});
