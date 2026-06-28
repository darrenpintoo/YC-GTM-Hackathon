import type { EventSignal, SignalType, Workspace } from "./types";

// ============================================================
// Curated demo data. Real, recognizable events + companies so
// judges can sanity-check the evidence live. Scores are hand-tuned
// for narrative; the live analyze path computes them from signals.
// ============================================================

let _id = 0;
const uid = () => `sig_${(_id++).toString(36)}`;

function sig(
  type: SignalType,
  company: string,
  descriptor: string,
  role: string,
  evidence: string,
  source: string,
  sourceLabel: string,
  matchToICP: number,
  confidence: number,
  lookalikeOf?: string,
): EventSignal {
  return {
    id: uid(),
    type,
    company,
    descriptor,
    role,
    evidence,
    source,
    sourceLabel,
    matchToICP,
    confidence,
    lookalikeOf,
  };
}

// -------------------- WORKSPACE 1: GTM SaaS --------------------

const saastr: Workspace["events"][number] = {
  id: "saastr-annual",
  name: "SaaStr Annual 2026",
  url: "https://www.saastr.com/annual",
  location: "San Mateo, CA",
  date: "Sep 8–10, 2026",
  category: "B2B SaaS · GTM",
  costEstimate: "Booth $18K–$45K · Platinum $90K+",
  blurb:
    "The largest B2B SaaS community event. Heavy operator presence, but sponsorship is expensive and noisy.",
  signals: [
    sig("company-presence", "Vanta", "Series C · Security compliance SaaS", "Platinum Sponsor",
      "Listed as a Platinum sponsor on the official partner grid.", "https://www.saastr.com/annual/sponsors", "saastr.com/sponsors", 0.94, 0.92, "Vanta"),
    sig("company-presence", "Rippling", "Late-stage · HR & IT platform", "Headline Speaker",
      "VP Revenue listed on the agenda for a scaling-GTM session.", "https://www.saastr.com/annual/agenda", "saastr.com/agenda", 0.9, 0.9, "Rippling"),
    sig("company-presence", "Pylon", "Series B · Support platform", "Exhibitor",
      "Booth #214 in the exhibitor directory.", "https://www.saastr.com/annual/sponsors", "saastr.com/sponsors", 0.88, 0.85, "Pylon"),
    sig("attendee", "Webflow", "Late-stage · Web platform", "Confirmed Attendee",
      "Three RevOps leaders RSVP'd on the public LinkedIn event page.", "https://www.linkedin.com/events/saastr-annual", "linkedin.com/events", 0.86, 0.74, "Webflow"),
    sig("company-presence", "Default", "Series A · Inbound revenue platform", "Exhibitor",
      "Listed in the exhibitor hall map.", "https://www.saastr.com/annual/sponsors", "saastr.com/sponsors", 0.83, 0.82),
    sig("social", "Clay", "Series B · GTM data tooling", "Side Event Host",
      "Posted a “see you at SaaStr” happy hour with 400+ RSVPs.", "https://www.linkedin.com/feed/", "linkedin.com/feed", 0.79, 0.7),
    sig("attendee", "Ramp", "Late-stage · Spend management", "Confirmed Attendee",
      "Two AEs and a sales director publicly RSVP'd.", "https://www.linkedin.com/events/saastr-annual", "linkedin.com/events", 0.84, 0.72, "Ramp"),
    sig("icp-proxy", "—", "Agenda theme", "Topic Track",
      "Dedicated track on “Scaling outbound past Series B” — exact buyer language.", "https://www.saastr.com/annual/agenda", "saastr.com/agenda", 0.81, 0.88),
    sig("company-presence", "Deel", "Late-stage · Global payroll", "Sponsor",
      "Gold sponsor on the partner grid.", "https://www.saastr.com/annual/sponsors", "saastr.com/sponsors", 0.82, 0.86, "Deel"),
    sig("historical", "—", "2025 recap", "Past Event",
      "2025 recap reported 12,500 attendees, ~45% VP+ titles.", "https://www.saastr.com/2025-recap", "saastr.com/recap", 0.7, 0.8),
  ],
  score: {
    total: 84, icpFit: 27, accountSignal: 22, buyerDensity: 13, pipelineUpside: 12, costRisk: 6, evidenceConfidence: 4,
  },
  memo: {
    verdict: "attend",
    headline: "Attend. Do not buy the Platinum.",
    rationale:
      "Strong operator density and 6 companies that look exactly like your closed-won set (Vanta, Rippling, Ramp, Deel, Webflow, Pylon). But the room is enormous and sponsorship is priced for brand, not pipeline. Send 3 reps, run a side dinner, skip the booth.",
    sponsorThreshold: "$18K",
    successCriteria: "10 qualified meetings booked pre-event",
    expectedPipeline: "$220K–$420K",
    missingData: ["Full attendee list is gated", "Booth foot-traffic history"],
    nextAction: "Pre-book meetings with the 6 lookalike accounts now; host a 30-person dinner instead of a booth.",
  },
};

const gtmSummit: Workspace["events"][number] = {
  id: "pavilion-gtm",
  name: "Pavilion GTM Summit 2026",
  url: "https://www.joinpavilion.com/gtm-summit",
  location: "Austin, TX",
  date: "Oct 21–22, 2026",
  category: "RevOps · GTM Leadership",
  costEstimate: "Sponsor $25K–$60K",
  blurb:
    "Smaller, high-title concentration. Fewer logos, denser buyers. The sleeper pick.",
  signals: [
    sig("icp-proxy", "—", "Attendee profile", "Audience",
      "Members-only event: ~70% are VP Sales / CRO / RevOps leaders.", "https://www.joinpavilion.com/gtm-summit", "joinpavilion.com", 0.92, 0.83),
    sig("company-presence", "Clari", "Late-stage · Revenue platform", "Sponsor",
      "Named sponsor on the summit page.", "https://www.joinpavilion.com/gtm-summit", "joinpavilion.com", 0.85, 0.84, "Clari"),
    sig("attendee", "Vanta", "Series C · Compliance SaaS", "Confirmed Attendee",
      "CRO confirmed as a panelist.", "https://www.joinpavilion.com/gtm-summit/agenda", "joinpavilion.com/agenda", 0.94, 0.9, "Vanta"),
    sig("social", "6sense", "Late-stage · ABM platform", "Speaker",
      "VP posted about presenting on signal-based selling.", "https://www.linkedin.com/feed/", "linkedin.com/feed", 0.8, 0.72),
    sig("attendee", "Ramp", "Late-stage · Spend management", "Confirmed Attendee",
      "Head of RevOps RSVP'd publicly.", "https://www.linkedin.com/events/pavilion-gtm", "linkedin.com/events", 0.86, 0.7, "Ramp"),
    sig("icp-proxy", "—", "Agenda theme", "Topic Track",
      "Whole track on “Buying signals & intent data” — your exact category.", "https://www.joinpavilion.com/gtm-summit/agenda", "joinpavilion.com/agenda", 0.9, 0.85),
    sig("company-presence", "Default", "Series A · Revenue platform", "Exhibitor",
      "Listed among demo partners.", "https://www.joinpavilion.com/gtm-summit", "joinpavilion.com", 0.82, 0.78),
  ],
  score: {
    total: 77, icpFit: 26, accountSignal: 18, buyerDensity: 14, pipelineUpside: 11, costRisk: 5, evidenceConfidence: 3,
  },
  memo: {
    verdict: "sponsor",
    headline: "Sponsor this one. It's where the buyers actually are.",
    rationale:
      "Lower logo count but the highest buyer density we found — 70% VP+ and a dedicated intent-data track. Three closed-won lookalikes already confirmed. Smaller room means your reps actually get meetings. This is a pipeline event, not a brand event.",
    sponsorThreshold: "$45K",
    successCriteria: "8 qualified meetings + 2 design partners",
    expectedPipeline: "$260K–$480K",
    missingData: ["Final attendee count", "2025 outcome benchmark"],
    nextAction: "Take the $25K sponsorship tier and request the speaker slot on signal-based selling.",
  },
};

const inbound: Workspace["events"][number] = {
  id: "inbound-2026",
  name: "HubSpot INBOUND 2026",
  url: "https://www.inbound.com",
  location: "San Francisco, CA",
  date: "Sep 3–5, 2026",
  category: "Marketing · SaaS",
  costEstimate: "Booth $30K–$120K",
  blurb:
    "Massive, marketing-skewed audience. Great brand reach, diluted for a sales-data product.",
  signals: [
    sig("historical", "—", "2025 recap", "Past Event",
      "2025 drew ~12,000 attendees, marketing-heavy mix.", "https://www.inbound.com/recap", "inbound.com/recap", 0.55, 0.82),
    sig("company-presence", "ZoomInfo", "Public · GTM data", "Sponsor",
      "Returning sponsor — but a competitor, not a buyer.", "https://www.inbound.com/sponsors", "inbound.com/sponsors", 0.4, 0.85),
    sig("attendee", "Webflow", "Late-stage · Web platform", "Confirmed Attendee",
      "Marketing team RSVP'd; few RevOps titles visible.", "https://www.linkedin.com/events/inbound", "linkedin.com/events", 0.62, 0.65, "Webflow"),
    sig("icp-proxy", "—", "Audience profile", "Audience",
      "Title mix skews CMO / content / demand-gen — not your primary buyer.", "https://www.inbound.com", "inbound.com", 0.48, 0.78),
    sig("company-presence", "Apollo", "Late-stage · Sales engagement", "Exhibitor",
      "Large booth presence — adjacent competitor.", "https://www.inbound.com/sponsors", "inbound.com/sponsors", 0.45, 0.8),
    sig("social", "Mutiny", "Series B · Personalization", "Side Event",
      "Hosting a marketing-leaders dinner.", "https://www.linkedin.com/feed/", "linkedin.com/feed", 0.58, 0.6),
  ],
  score: {
    total: 58, icpFit: 16, accountSignal: 12, buyerDensity: 8, pipelineUpside: 9, costRisk: 9, evidenceConfidence: 4,
  },
  memo: {
    verdict: "reps-only",
    headline: "Reps only. High logo density, weak buyer density.",
    rationale:
      "Huge audience but it's marketing-skewed and crowded with competitors (ZoomInfo, Apollo) selling to the same people. Your buyer (RevOps / VP Sales) is underrepresented. A $30K+ booth here is brand spend dressed up as pipeline.",
    sponsorThreshold: "Do not sponsor",
    successCriteria: "4 qualified meetings (rep-driven, no booth)",
    expectedPipeline: "$60K–$140K",
    missingData: ["RevOps-specific attendee share", "Competitor adjacency cost"],
    nextAction: "Send 2 reps for the side events. Skip the booth entirely.",
  },
};

const websummit: Workspace["events"][number] = {
  id: "web-summit",
  name: "Web Summit 2026",
  url: "https://websummit.com",
  location: "Lisbon, PT",
  date: "Nov 9–12, 2026",
  category: "Tech · General",
  costEstimate: "Booth $20K–$80K + intl travel",
  blurb: "Enormous, generalist, press-driven. Beautiful chaos, thin on your buyer.",
  signals: [
    sig("historical", "—", "2025 recap", "Past Event",
      "70,000+ attendees across every sector — extreme dilution.", "https://websummit.com/recap", "websummit.com/recap", 0.3, 0.85),
    sig("icp-proxy", "—", "Audience profile", "Audience",
      "Audience spans consumer, hardware, crypto, media — B2B SaaS is a sliver.", "https://websummit.com", "websummit.com", 0.28, 0.8),
    sig("social", "—", "General buzz", "Social",
      "High social volume, almost none from your ICP titles.", "https://www.linkedin.com/feed/", "linkedin.com/feed", 0.32, 0.55),
    sig("company-presence", "Generic startups", "Mixed early-stage", "Exhibitors",
      "Exhibitor hall is mostly pre-seed startups, not buyers.", "https://websummit.com/exhibitors", "websummit.com", 0.3, 0.7),
  ],
  score: {
    total: 36, icpFit: 9, accountSignal: 5, buyerDensity: 4, pipelineUpside: 4, costRisk: 10, evidenceConfidence: 4,
  },
  memo: {
    verdict: "skip",
    headline: "False. This event is popular, not profitable.",
    rationale:
      "70,000 people and almost none of them are your buyer. Add international travel and a 4-day rep cost and the break-even is fantasy. The only reason to go is FOMO.",
    sponsorThreshold: "Do not sponsor",
    successCriteria: "—",
    expectedPipeline: "$0–$40K",
    missingData: ["Any evidence of concentrated B2B-SaaS buyers"],
    nextAction: "Skip. Redirect the budget to Pavilion GTM Summit.",
  },
};

// -------------------- WORKSPACE 2: Industrial (the wedge) --------------------

const worldofconcrete: Workspace["events"][number] = {
  id: "world-of-concrete",
  name: "World of Concrete 2026",
  url: "https://www.worldofconcrete.com",
  location: "Las Vegas, NV",
  date: "Jan 20–22, 2026",
  category: "Construction · Trade Show",
  costEstimate: "Booth $12K–$60K (quote-based)",
  blurb:
    "No public attendee list — the wedge. Schrute infers the room from sponsors, exhibitors, and association data.",
  signals: [
    sig("company-presence", "Turner Construction", "ENR Top-10 GC", "Exhibitor",
      "Listed in the exhibitor directory under safety tech.", "https://www.worldofconcrete.com/exhibitors", "worldofconcrete.com", 0.93, 0.88, "Turner Construction"),
    sig("company-presence", "Suffolk", "ENR Top-25 GC", "Booth Host",
      "Hosting a jobsite-safety demo booth.", "https://www.worldofconcrete.com/exhibitors", "worldofconcrete.com", 0.9, 0.82, "Suffolk"),
    sig("icp-proxy", "—", "Agenda theme", "Education Track",
      "Full education track on OSHA compliance & jobsite safety tech — your buyer's language.", "https://www.worldofconcrete.com/education", "worldofconcrete.com", 0.88, 0.85),
    sig("historical", "DPR Construction", "ENR Top-10 GC", "Past Exhibitor",
      "Appeared in 2024 & 2025 exhibitor directories — recurring presence.", "https://www.worldofconcrete.com/2025", "worldofconcrete.com/2025", 0.85, 0.8, "DPR Construction"),
    sig("icp-proxy", "AGC Members", "Trade association", "Association",
      "Co-located with AGC chapters — your closed-won accounts are AGC members.", "https://www.agc.org", "agc.org", 0.82, 0.76),
    sig("company-presence", "Hensel Phelps", "ENR Top-15 GC", "Exhibitor",
      "Booth in the equipment & safety hall.", "https://www.worldofconcrete.com/exhibitors", "worldofconcrete.com", 0.84, 0.78, "Hensel Phelps"),
    sig("social", "Mortenson", "ENR Top-25 GC", "Social",
      "Safety director posted about attending the safety track.", "https://www.linkedin.com/feed/", "linkedin.com/feed", 0.8, 0.66, "Mortenson"),
  ],
  score: {
    total: 79, icpFit: 26, accountSignal: 20, buyerDensity: 12, pipelineUpside: 12, costRisk: 6, evidenceConfidence: 3,
  },
  memo: {
    verdict: "attend",
    headline: "Attend. No attendee list needed — we inferred the room.",
    rationale:
      "There is no public attendee list, and it doesn't matter. Sponsor, exhibitor, association, and historical evidence put 5 ENR-ranked GCs that mirror your closed-won set in the room, plus a safety-compliance track that speaks your buyer's language. Confidence is medium — proxy-driven, not direct.",
    sponsorThreshold: "$14K",
    successCriteria: "6 qualified meetings with ENR-ranked GCs",
    expectedPipeline: "$180K–$340K",
    missingData: ["Direct attendee list (gated)", "Quote-based booth pricing"],
    nextAction: "Request a quote, cap booth spend at $14K, pre-target the 5 lookalike GCs.",
  },
};

const nsc: Workspace["events"][number] = {
  id: "nsc-safety",
  name: "NSC Safety Congress & Expo 2026",
  url: "https://congress.nsc.org",
  location: "Orlando, FL",
  date: "Oct 12–14, 2026",
  category: "Safety · EHS",
  costEstimate: "Booth $9K–$40K (quote-based)",
  blurb: "The purest buyer concentration — EHS and safety leaders, exactly who signs.",
  signals: [
    sig("icp-proxy", "—", "Attendee profile", "Audience",
      "Audience is ~60% EHS managers, safety directors, risk leaders — your economic buyer.", "https://congress.nsc.org", "congress.nsc.org", 0.94, 0.84),
    sig("company-presence", "Skanska USA", "ENR Top-10 GC", "Exhibitor",
      "Listed exhibitor with a safety-innovation booth.", "https://congress.nsc.org/exhibitors", "nsc.org/exhibitors", 0.9, 0.82, "Skanska USA"),
    sig("historical", "Kiewit", "ENR Top-10 GC", "Past Speaker",
      "Safety VP keynoted in 2024 — recurring high-title presence.", "https://congress.nsc.org/2024", "nsc.org/2024", 0.88, 0.8, "Kiewit"),
    sig("icp-proxy", "—", "Agenda theme", "Education Track",
      "Sessions on jobsite wearables & incident analytics — your product category.", "https://congress.nsc.org/education", "nsc.org/education", 0.9, 0.83),
    sig("company-presence", "Turner Construction", "ENR Top-10 GC", "Attendee Org",
      "Multiple safety staff registered via the corporate group rate.", "https://congress.nsc.org/exhibitors", "nsc.org", 0.86, 0.7, "Turner Construction"),
  ],
  score: {
    total: 73, icpFit: 26, accountSignal: 16, buyerDensity: 14, pipelineUpside: 10, costRisk: 5, evidenceConfidence: 2,
  },
  memo: {
    verdict: "sponsor",
    headline: "Sponsor. This is the buyer, undiluted.",
    rationale:
      "The audience IS your economic buyer — EHS and safety leaders, not vendors. Two ENR-10 GCs in evidence and a session track on exactly what you sell. Smaller and cheaper than World of Concrete with higher buyer purity. Evidence is thinner (proxy-heavy) so treat confidence as medium.",
    sponsorThreshold: "$25K",
    successCriteria: "7 qualified meetings with EHS decision-makers",
    expectedPipeline: "$210K–$360K",
    missingData: ["Direct attendee list", "Exact 2026 session lineup"],
    nextAction: "Take a mid-tier sponsorship and apply for a speaking slot on incident analytics.",
  },
};

const conexpo: Workspace["events"][number] = {
  id: "conexpo",
  name: "CONEXPO-CON/AGG 2026",
  url: "https://www.conexpoconagg.com",
  location: "Las Vegas, NV",
  date: "Mar 3–7, 2026",
  category: "Heavy Equipment",
  costEstimate: "Booth $30K–$150K",
  blurb: "Equipment-buyer mega-show. Some overlap, but skewed to machinery, not safety software.",
  signals: [
    sig("historical", "—", "2023 recap", "Past Event",
      "139,000 attendees — but dominated by equipment & fleet buyers.", "https://www.conexpoconagg.com/recap", "conexpoconagg.com", 0.45, 0.82),
    sig("icp-proxy", "—", "Audience profile", "Audience",
      "Buyer intent is machinery/fleet, not EHS software.", "https://www.conexpoconagg.com", "conexpoconagg.com", 0.42, 0.78),
    sig("company-presence", "Caterpillar", "OEM", "Anchor Exhibitor",
      "Anchor exhibitor — but an OEM, not your buyer.", "https://www.conexpoconagg.com/exhibitors", "conexpoconagg.com", 0.35, 0.85),
    sig("company-presence", "Turner Construction", "ENR Top-10 GC", "Attendee Org",
      "Likely present, but for equipment procurement, not safety software.", "https://www.conexpoconagg.com/exhibitors", "conexpoconagg.com", 0.55, 0.6, "Turner Construction"),
  ],
  score: {
    total: 49, icpFit: 14, accountSignal: 9, buyerDensity: 7, pipelineUpside: 7, costRisk: 8, evidenceConfidence: 4,
  },
  memo: {
    verdict: "maybe",
    headline: "Maybe — but only with a scout, not a booth.",
    rationale:
      "Your accounts attend, but to buy excavators, not safety software. A $30K+ booth competes with Caterpillar for attention you won't win. The economic buyer for your product is at NSC, not here.",
    sponsorThreshold: "Do not sponsor",
    successCriteria: "3 exploratory meetings (scout only)",
    expectedPipeline: "$40K–$120K",
    missingData: ["Share of safety/EHS titles vs. fleet buyers"],
    nextAction: "Send one scout to validate buyer presence before ever committing budget.",
  },
};

export const WORKSPACES: Workspace[] = [
  {
    id: "gtm-saas",
    name: "Atlas Signals",
    context: "Buyer-intent platform for B2B SaaS sales teams",
    profile: {
      company: "Atlas Signals",
      tagline: "Buyer-intent & account signals for B2B SaaS sales teams",
      bestFitIndustries: ["B2B SaaS", "Fintech infra", "Security / compliance", "DevTools"],
      buyerPersonas: ["VP Sales / CRO", "Head of RevOps", "Head of Growth"],
      dealSizeBand: "$28K–$120K ACV",
      geographies: ["US — SF Bay", "US — NYC", "US — Austin"],
      closedWonLookalikes: ["Vanta", "Rippling", "Ramp", "Deel", "Webflow", "Pylon", "Clari"],
      keywords: ["buying signals", "intent data", "outbound", "RevOps", "pipeline", "ABM"],
      eventGoal: "Qualified meetings with VP Sales / RevOps at Series A–C SaaS",
    },
    events: [saastr, gtmSummit, inbound, websummit],
  },
  {
    id: "industrial",
    name: "Sitewise",
    context: "Jobsite safety & compliance software for GCs",
    profile: {
      company: "Sitewise",
      tagline: "Jobsite safety, incident analytics & OSHA compliance for general contractors",
      bestFitIndustries: ["Commercial construction", "Heavy civil", "Industrial services"],
      buyerPersonas: ["VP Safety / EHS Director", "Risk Manager", "VP Operations"],
      dealSizeBand: "$40K–$180K ACV",
      geographies: ["US — National", "US — Sunbelt"],
      closedWonLookalikes: ["Turner Construction", "DPR Construction", "Suffolk", "Hensel Phelps", "Skanska USA", "Kiewit", "Mortenson"],
      keywords: ["jobsite safety", "OSHA", "EHS", "incident analytics", "wearables", "compliance"],
      eventGoal: "Qualified meetings with EHS / Safety leaders at ENR-ranked GCs",
    },
    events: [worldofconcrete, nsc, conexpo],
  },
];

export function getWorkspace(id: string): Workspace | undefined {
  return WORKSPACES.find((w) => w.id === id);
}

export function getEvent(workspaceId: string, eventId: string) {
  const ws = getWorkspace(workspaceId);
  return ws?.events.find((e) => e.id === eventId);
}
