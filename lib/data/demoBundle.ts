/**
 * Frontend-owned demo dataset (Darren).
 *
 * Richer than the shared `lib/mocks.ts` contract fixture so the UI demo lands
 * the README narrative ("18 of your accounts are here, 6 open deals worth
 * $640K"). Kept separate from `lib/mocks.ts` to avoid conflicts with the
 * shared contract owned by the whole team. All numbers are internally
 * consistent so the underwriting math reads true on stage.
 */

import type {
  AccountMatch,
  Contact,
  CrmAccount,
  CrmAccountType,
  DecisionMemo,
  Event,
  EventCompany,
  EventCompanyRole,
  EventScore,
  Evidence,
  Job,
  MatchTier,
  RevenueProfile,
  SchruteDemoBundle,
  SourceDocument,
} from "@/lib/types";

const NOW = Date.parse("2026-06-28T12:00:00.000Z");

const ATTEND_EVENT_ID = "demo_event_woc_2026";
const SKIP_EVENT_ID = "demo_event_regional_expo";
const PROFILE_ID = "demo_profile_safesite";
const SOURCE_ID = "demo_source_woc";
const SCORE_ID = "demo_score_woc";
const MEMO_ID = "demo_memo_woc";

const WOC_URL = "https://www.worldofconcrete.com/en/exhibitor-list.html";

function ev(
  quote: string,
  factType: Evidence["factType"] = "exhibitor",
  confidence = 0.95,
): Evidence {
  return {
    sourceDocumentId: SOURCE_ID,
    sourceUrl: WOC_URL,
    quote,
    factType,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Revenue profile
// ---------------------------------------------------------------------------

export const demoRevenueProfile: RevenueProfile = {
  _id: PROFILE_ID,
  name: "SafeSite OS",
  industries: [
    "General Contracting",
    "Commercial Construction",
    "Industrial Construction",
    "Heavy Civil",
  ],
  buyerTitles: [
    "VP Safety",
    "Director of EHS",
    "Safety Manager",
    "VP Operations",
    "Project Executive",
  ],
  dealSizeClusters: [
    { label: "Mid-market", min: 40000, max: 120000, count: 22 },
    { label: "Enterprise", min: 120000, max: 350000, count: 8 },
  ],
  geographies: ["US Midwest", "US South", "US West", "US Northeast"],
  keywords: [
    "jobsite safety",
    "OSHA compliance",
    "subcontractor management",
    "incident reporting",
  ],
  closedWonPatterns: [
    "Multi-site GCs with subcontractor compliance pain",
    "Industrial contractors with incident reporting gaps",
  ],
  createdAt: NOW - 86400000,
};

// ---------------------------------------------------------------------------
// Matches (compact spec -> full rows)
// ---------------------------------------------------------------------------

type MatchSpec = {
  key: string;
  name: string;
  domain?: string;
  tier: MatchTier;
  accountType?: CrmAccountType;
  role: EventCompanyRole;
  booth?: string;
  fit: number;
  conf: number;
  opp?: number;
  region?: string;
  buyerTitle?: string;
  stage?: string;
};

const MATCH_SPECS: MatchSpec[] = [
  // Tier 1 — open opps (6, summing to $640K)
  { key: "turner", name: "Turner Construction", domain: "turnerconstruction.com", tier: "tier1_crm", accountType: "open_opp", role: "exhibitor", booth: "N1234", fit: 0.98, conf: 0.97, opp: 180000, region: "US Northeast", buyerTitle: "VP Safety", stage: "Negotiation" },
  { key: "skanska", name: "Skanska USA", domain: "usa.skanska.com", tier: "tier1_crm", accountType: "open_opp", role: "exhibitor", booth: "S4521", fit: 0.95, conf: 0.96, opp: 120000, region: "US Northeast", buyerTitle: "Director of EHS", stage: "Proposal" },
  { key: "mccarthy", name: "McCarthy Building Companies", domain: "mccarthy.com", tier: "tier1_crm", accountType: "open_opp", role: "sponsor", booth: "Gold Sponsor", fit: 0.93, conf: 0.94, opp: 110000, region: "US West", buyerTitle: "VP Operations", stage: "Discovery" },
  { key: "dpr", name: "DPR Construction", domain: "dpr.com", tier: "tier1_crm", accountType: "open_opp", role: "exhibitor", booth: "C2210", fit: 0.92, conf: 0.93, opp: 95000, region: "US West", buyerTitle: "Director of EHS", stage: "Discovery" },
  { key: "suffolk", name: "Suffolk Construction", domain: "suffolk.com", tier: "tier1_crm", accountType: "open_opp", role: "exhibitor", booth: "S3310", fit: 0.9, conf: 0.91, opp: 75000, region: "US Northeast", buyerTitle: "Safety Manager", stage: "Proposal" },
  { key: "webcor", name: "Webcor", domain: "webcor.com", tier: "tier1_crm", accountType: "open_opp", role: "exhibitor", booth: "W1140", fit: 0.88, conf: 0.9, opp: 60000, region: "US West", buyerTitle: "VP Safety", stage: "Discovery" },

  // Tier 1 — closed-won lookalikes (4)
  { key: "mortenson", name: "Mortenson", domain: "mortenson.com", tier: "tier1_crm", accountType: "closed_won", role: "exhibitor", booth: "N8820", fit: 0.9, conf: 0.92, region: "US Midwest", buyerTitle: "Safety Manager" },
  { key: "brasfield", name: "Brasfield & Gorrie", domain: "brasfieldgorrie.com", tier: "tier1_crm", accountType: "closed_won", role: "exhibitor", booth: "S2204", fit: 0.87, conf: 0.9, region: "US South", buyerTitle: "VP Operations" },
  { key: "henselphelps", name: "Hensel Phelps", domain: "henselphelps.com", tier: "tier1_crm", accountType: "closed_won", role: "exhibitor", booth: "C1820", fit: 0.86, conf: 0.89, region: "US West", buyerTitle: "Director of EHS" },
  { key: "jedunn", name: "JE Dunn Construction", domain: "jedunn.com", tier: "tier1_crm", accountType: "closed_won", role: "speaker", booth: "Safety Track 2:00 PM", fit: 0.85, conf: 0.88, region: "US Midwest", buyerTitle: "VP Safety" },

  // Tier 1 — targets (4)
  { key: "clark", name: "Clark Construction", domain: "clarkconstruction.com", tier: "tier1_crm", accountType: "target", role: "exhibitor", booth: "C1102", fit: 0.89, conf: 0.93, region: "US Mid-Atlantic", buyerTitle: "VP Safety" },
  { key: "haskell", name: "The Haskell Company", domain: "haskell.com", tier: "tier1_crm", accountType: "target", role: "sponsor", booth: "Silver Sponsor", fit: 0.84, conf: 0.9, region: "US South", buyerTitle: "Director of EHS" },
  { key: "gilbane", name: "Gilbane Building Company", domain: "gilbaneco.com", tier: "tier1_crm", accountType: "target", role: "exhibitor", booth: "N4410", fit: 0.83, conf: 0.88, region: "US Northeast", buyerTitle: "VP Safety" },
  { key: "kiewit", name: "Kiewit", domain: "kiewit.com", tier: "tier1_crm", accountType: "target", role: "exhibitor", booth: "W2680", fit: 0.82, conf: 0.86, region: "US Midwest", buyerTitle: "VP Operations" },

  // Tier 2 — net-new ICP (4)
  { key: "buildright", name: "BuildRight Materials", tier: "tier2_icp", role: "exhibitor", booth: "W2201", fit: 0.79, conf: 0.88 },
  { key: "sitesecure", name: "SiteSecure Systems", tier: "tier2_icp", role: "exhibitor", booth: "C3015", fit: 0.76, conf: 0.85 },
  { key: "proguard", name: "ProGuard EHS Solutions", tier: "tier2_icp", role: "sponsor", booth: "Bronze Sponsor", fit: 0.74, conf: 0.83 },
  { key: "concreteflow", name: "ConcreteFlow Co", tier: "tier2_icp", role: "exhibitor", booth: "S5120", fit: 0.71, conf: 0.8 },
];

function roleQuote(spec: MatchSpec): string {
  if (spec.role === "sponsor") return `${spec.name} — ${spec.booth}`;
  if (spec.role === "speaker") return `${spec.name} — Speaking, ${spec.booth}`;
  return `${spec.name} — Booth ${spec.booth}`;
}

function roleFactType(role: EventCompanyRole): Evidence["factType"] {
  if (role === "sponsor") return "sponsor";
  if (role === "speaker") return "speaker";
  return "exhibitor";
}

export const demoMatches: AccountMatch[] = MATCH_SPECS.map((spec, i) => {
  const contacts: Record<
    string,
    { contactName: string; contactTitle: string }
  > = {
    turner: { contactName: "Jane Doe", contactTitle: "VP Safety" },
    skanska: { contactName: "Mark Reynolds", contactTitle: "Director of EHS" },
    mccarthy: { contactName: "Lisa Tran", contactTitle: "VP Operations" },
    jedunn: { contactName: "David Chen", contactTitle: "VP Safety" },
  };
  const contact = contacts[spec.key];
  return {
    _id: `demo_match_${spec.key}`,
    eventId: ATTEND_EVENT_ID,
    tier: spec.tier,
    crmAccountId: spec.tier === "tier1_crm" ? `demo_crm_${spec.key}` : undefined,
    companyName: spec.name,
    domain: spec.domain,
    role: spec.role,
    boothOrSession: spec.booth,
    fitScore: spec.fit,
    confidence: spec.conf,
    evidence: [ev(roleQuote(spec), roleFactType(spec.role), spec.conf)],
    matchedOppValue: spec.opp,
    eventCompanyId: `demo_ec_${spec.key}`,
    rank: i + 1,
    presence: "confirmed" as const,
    contactName: contact?.contactName,
    contactTitle: contact?.contactTitle,
    createdAt: NOW - 3200000,
  };
});

const RECURRING_SPECS: Array<{
  key: string;
  name: string;
  role: EventCompanyRole;
  booth?: string;
  editionLabel: string;
}> = [
  { key: "fluor", name: "Fluor Corporation", role: "sponsor", booth: "Gold Sponsor", editionLabel: "World of Concrete 2025" },
  { key: "bechtel", name: "Bechtel", role: "exhibitor", booth: "N2100", editionLabel: "World of Concrete 2025" },
  { key: "aecom", name: "AECOM", role: "exhibitor", booth: "S1800", editionLabel: "World of Concrete 2024" },
  { key: "pcl", name: "PCL Construction", role: "sponsor", booth: "Silver Sponsor", editionLabel: "World of Concrete 2024" },
  { key: "balfour", name: "Balfour Beatty US", role: "exhibitor", booth: "C902", editionLabel: "World of Concrete 2024" },
  { key: "walsh", name: "Walsh Group", role: "exhibitor", booth: "W1400", editionLabel: "World of Concrete 2025" },
  { key: "whiting", name: "Whiting-Turner", role: "exhibitor", booth: "N3300", editionLabel: "World of Concrete 2024" },
  { key: "holder", name: "Holder Construction", role: "exhibitor", booth: "S1102", editionLabel: "World of Concrete 2025" },
];

export const demoRecurringMatches: AccountMatch[] = RECURRING_SPECS.map(
  (spec, i) => ({
    _id: `demo_match_recurring_${spec.key}`,
    eventId: ATTEND_EVENT_ID,
    tier: "tier2_icp" as MatchTier,
    companyName: spec.name,
    role: spec.role,
    boothOrSession: spec.booth,
    fitScore: 0.62 - i * 0.01,
    confidence: 0.88,
    evidence: [
      ev(
        `${spec.name} — ${spec.booth ?? "listed"} (${spec.editionLabel})`,
        roleFactType(spec.role),
        0.88,
      ),
    ],
    rank: demoMatches.length + i + 1,
    presence: "recurring" as const,
    editionLabel: spec.editionLabel,
    createdAt: NOW - 3200000,
  }),
);

export const demoAllMatches: AccountMatch[] = [
  ...demoMatches,
  ...demoRecurringMatches,
];

export const demoCrmAccounts: CrmAccount[] = [
  ...MATCH_SPECS.filter((s) => s.tier === "tier1_crm").map((s) => ({
    _id: `demo_crm_${s.key}`,
    revenueProfileId: PROFILE_ID,
    companyName: s.name,
    domain: s.domain,
    accountType: s.accountType ?? "target",
    stage: s.stage ?? (s.accountType === "closed_won" ? "Closed Won" : "Target"),
    dealSize: s.opp ?? 80000,
    industry: "General Contracting",
    region: s.region,
    buyerTitle: s.buyerTitle,
    openOppValue: s.opp,
    createdAt: NOW - 86400000,
  })),
  // CRM accounts NOT at this event (proves the matcher is selective)
  ...[
    "Whiting-Turner",
    "Holder Construction",
    "Swinerton",
    "Balfour Beatty US",
    "PCL Construction",
    "Walsh Group",
    "Austin Industries",
  ].map((name, i) => ({
    _id: `demo_crm_absent_${i}`,
    revenueProfileId: PROFILE_ID,
    companyName: name,
    accountType: (i % 3 === 0 ? "open_opp" : "target") as CrmAccountType,
    stage: "Discovery",
    dealSize: 70000,
    industry: "Commercial Construction",
    region: "US South",
    buyerTitle: "Director of EHS",
    openOppValue: i % 3 === 0 ? 70000 : undefined,
    createdAt: NOW - 86400000,
  })),
];

// ---------------------------------------------------------------------------
// Contacts + outreach (a few seeded; others enriched live on stage)
// ---------------------------------------------------------------------------

export const demoContacts: Contact[] = [
  {
    _id: "demo_contact_turner",
    accountMatchId: "demo_match_turner",
    eventId: ATTEND_EVENT_ID,
    fullName: "Jane Doe",
    title: "VP Safety",
    email: "jane.doe@turnerconstruction.com",
    phone: "+1 (212) 555-0142",
    linkedinUrl: "https://www.linkedin.com/in/jane-doe-safety",
    verification: "verified",
    createdAt: NOW - 2800000,
  },
  {
    _id: "demo_contact_skanska",
    accountMatchId: "demo_match_skanska",
    eventId: ATTEND_EVENT_ID,
    fullName: "Mark Reynolds",
    title: "Director of EHS",
    email: "mark.reynolds@usa.skanska.com",
    linkedinUrl: "https://www.linkedin.com/in/mark-reynolds-ehs",
    verification: "verified",
    createdAt: NOW - 2800000,
  },
  {
    _id: "demo_contact_mccarthy",
    accountMatchId: "demo_match_mccarthy",
    eventId: ATTEND_EVENT_ID,
    fullName: "Lisa Tran",
    title: "VP Operations",
    email: "ltran@mccarthy.com",
    verification: "likely",
    createdAt: NOW - 2800000,
  },
  {
    _id: "demo_contact_mortenson",
    accountMatchId: "demo_match_mortenson",
    eventId: ATTEND_EVENT_ID,
    fullName: "Carlos Mendez",
    title: "Safety Manager",
    email: "cmendez@mortenson.com",
    phone: "+1 (763) 555-0199",
    verification: "verified",
    createdAt: NOW - 2800000,
  },
  {
    _id: "demo_contact_buildright",
    accountMatchId: "demo_match_buildright",
    eventId: ATTEND_EVENT_ID,
    fullName: "Priya Shah",
    title: "Head of Field Operations",
    email: "priya@buildrightmaterials.com",
    verification: "likely",
    createdAt: NOW - 2800000,
  },
];

export const demoOutreachDrafts = [
  {
    _id: "demo_outreach_turner",
    accountMatchId: "demo_match_turner",
    contactId: "demo_contact_turner",
    eventId: ATTEND_EVENT_ID,
    subject: "Quick coffee at World of Concrete?",
    body: "Hi Jane — saw Turner is exhibiting at World of Concrete (Booth N1234). We're deep in the safety-workflow conversation with several GCs and I'd love 20 minutes before the floor gets loud. We have an open proposal on your desk — figured the show is a good excuse to close the loop in person. Tue AM work?",
    tone: "direct",
    createdAt: NOW - 2700000,
  },
  {
    _id: "demo_outreach_skanska",
    accountMatchId: "demo_match_skanska",
    contactId: "demo_contact_skanska",
    eventId: ATTEND_EVENT_ID,
    subject: "EHS workflows @ WoC — 15 min?",
    body: "Hi Mark — Skanska's at World of Concrete (Booth S4521) and so are we. Given where our proposal stands, a quick in-person on incident-reporting rollout would beat another Zoom. Free Wednesday before lunch?",
    tone: "direct",
    createdAt: NOW - 2700000,
  },
  {
    _id: "demo_outreach_mccarthy",
    accountMatchId: "demo_match_mccarthy",
    contactId: "demo_contact_mccarthy",
    eventId: ATTEND_EVENT_ID,
    subject: "McCarthy + SafeSite at World of Concrete",
    body: "Hi Lisa — congrats on the Gold sponsorship at WoC. We help multi-site GCs cut subcontractor-compliance overhead and I'd value 15 minutes to see if it maps to McCarthy's jobsite ops. Around the floor Tuesday?",
    tone: "warm",
    createdAt: NOW - 2700000,
  },
  {
    _id: "demo_outreach_mortenson",
    accountMatchId: "demo_match_mortenson",
    contactId: "demo_contact_mortenson",
    eventId: ATTEND_EVENT_ID,
    subject: "Good to reconnect at WoC",
    body: "Hi Carlos — great seeing Mortenson back at World of Concrete (Booth N8820). Since you're already live on SafeSite, I'd love to show you what's shipped this quarter and hear what's working. Coffee Wednesday?",
    tone: "warm",
    createdAt: NOW - 2700000,
  },
];

// ---------------------------------------------------------------------------
// Event, source, score, memo, jobs
// ---------------------------------------------------------------------------

const ATTEND_ASSUMPTIONS = {
  sponsorCost: 25000,
  travelCost: 6000,
  repTimeCost: 4000,
  avgDealSize: 95000,
  meetingToOppRate: 0.35,
  winRate: 0.22,
  riskDiscount: 0.85,
  captureRate: 0.12,
};

export const demoAttendEvent: Event = {
  _id: ATTEND_EVENT_ID,
  name: "World of Concrete 2026",
  slug: "world-of-concrete-2026",
  startDate: "2026-01-20",
  endDate: "2026-01-22",
  location: "Las Vegas, NV",
  sponsorQuote: 25000,
  revenueProfileId: PROFILE_ID,
  assumptions: ATTEND_ASSUMPTIONS,
  createdAt: NOW - 3600000,
};

const demoSourceDocuments: SourceDocument[] = [
  {
    _id: SOURCE_ID,
    eventId: ATTEND_EVENT_ID,
    kind: "url",
    url: WOC_URL,
    title: "World of Concrete 2026 Exhibitor List",
    category: "exhibitors",
    textContent:
      "Exhibitor & Sponsor Directory — World of Concrete 2026. Booth N1234 Turner Construction · Booth S4521 Skanska USA · Gold Sponsor McCarthy Building Companies · Booth C2210 DPR Construction · Booth S3310 Suffolk Construction · Booth W1140 Webcor · Booth N8820 Mortenson · Booth S2204 Brasfield & Gorrie · Booth C1820 Hensel Phelps · Safety Track JE Dunn Construction · Booth C1102 Clark Construction · Silver Sponsor The Haskell Company · Booth N4410 Gilbane Building Company · Booth W2680 Kiewit · Booth W2201 BuildRight Materials · Booth C3015 SiteSecure Systems · Bronze Sponsor ProGuard EHS Solutions · Booth S5120 ConcreteFlow Co.",
    contentHash: "sha256:demo_woc_v2",
    fetchedAt: NOW - 3500000,
    charCount: 4200,
    scrapeStatus: "ok",
  },
  {
    _id: "demo_source_woc_sponsors",
    eventId: ATTEND_EVENT_ID,
    kind: "url",
    url: "https://www.worldofconcrete.com/en/sponsors.html",
    title: "World of Concrete 2026 Sponsors",
    category: "sponsors",
    textContent:
      "Gold Sponsor McCarthy Building Companies · Silver Sponsor The Haskell Company · Bronze Sponsor ProGuard EHS Solutions",
    contentHash: "sha256:demo_woc_sponsors",
    fetchedAt: NOW - 3480000,
    charCount: 1800,
    scrapeStatus: "ok",
  },
  {
    _id: "demo_source_woc_speakers",
    eventId: ATTEND_EVENT_ID,
    kind: "url",
    url: "https://www.worldofconcrete.com/en/education/speakers.html",
    title: "Safety Track Speakers",
    category: "speakers",
    textContent:
      "Safety Track 2:00 PM — JE Dunn Construction, VP Safety David Chen on jobsite compliance workflows.",
    contentHash: "sha256:demo_woc_speakers",
    fetchedAt: NOW - 3460000,
    charCount: 950,
    scrapeStatus: "ok",
  },
  {
    _id: "demo_source_woc_2025",
    eventId: ATTEND_EVENT_ID,
    kind: "url",
    url: "https://www.worldofconcrete.com/en/2025-exhibitors.html",
    title: "World of Concrete 2025 Exhibitor Archive",
    category: "past_edition",
    textContent:
      "Past edition exhibitors: Fluor Corporation Gold Sponsor · Bechtel Booth N2100 · Walsh Group Booth W1400 · Holder Construction Booth S1102",
    contentHash: "sha256:demo_woc_2025",
    fetchedAt: NOW - 3440000,
    charCount: 2100,
    scrapeStatus: "ok",
  },
];

const demoEventCompanies: EventCompany[] = MATCH_SPECS.map((spec) => ({
  _id: `demo_ec_${spec.key}`,
  eventId: ATTEND_EVENT_ID,
  sourceDocumentId: SOURCE_ID,
  companyName: spec.name,
  normalizedName: spec.name.toLowerCase(),
  domain: spec.domain,
  role: spec.role,
  boothOrSession: spec.booth,
  quote: roleQuote(spec),
  confidence: spec.conf,
  createdAt: NOW - 3300000,
}));

const openOppValue = demoMatches.reduce(
  (sum, m) => sum + (m.matchedOppValue ?? 0),
  0,
); // 640,000

export const demoAttendScore: EventScore = {
  _id: SCORE_ID,
  eventId: ATTEND_EVENT_ID,
  totalEventCost: 35000,
  revenuePerQualifiedMeeting: 6213,
  requiredQualifiedMeetings: 6,
  sponsorCap: 12000,
  matchedPipelineValue: openOppValue,
  tier1MatchCount: demoMatches.filter((m) => m.tier === "tier1_crm").length,
  tier2MatchCount:
    demoMatches.filter((m) => m.tier === "tier2_icp").length +
    demoRecurringMatches.length,
  recommendation: "attend",
  subScores: {
    pipelinePresence: 0.91,
    evidenceQuality: 0.93,
    costEfficiency: 0.74,
    icpDensity: 0.81,
  },
  assumptions: ATTEND_ASSUMPTIONS,
  rationale: [
    "14 Tier-1 CRM accounts confirmed present from public exhibitor/sponsor evidence.",
    "$640K matched open pipeline on the floor across 6 open deals — booth not required to reach them.",
    "Break-even needs 6 qualified meetings; you already have 6 open opps in the building.",
    "Sponsor cap is $12K — below the quoted $25K booth. Attend, don't sponsor.",
  ],
  createdAt: NOW - 3000000,
};

export const demoAttendMemo: DecisionMemo = {
  _id: MEMO_ID,
  eventId: ATTEND_EVENT_ID,
  eventScoreId: SCORE_ID,
  headline: "Attend — don't sponsor over $12K",
  verdict: "attend",
  sections: [
    {
      title: "Confirmed pipeline on the floor",
      body: "18 of your accounts are confirmed present at World of Concrete — 14 are already in your CRM, including 6 open deals worth $640K and 4 closed-won lookalikes. Evidence is exhibitor/sponsor-list sourced, not inferred personal attendance.",
      citations: [
        ev("Turner Construction — Booth N1234"),
        ev("Gold Sponsor McCarthy Building Companies", "sponsor"),
      ],
    },
    {
      title: "The economics",
      body: "All-in cost is ~$35K and needs 6 qualified meetings to break even. You already have 6 open opps walking this floor. The $25K booth doesn't change who shows up — send two reps and host a dinner.",
      citations: [],
    },
    {
      title: "Net-new prospecting",
      body: "4 strong-fit companies not in your CRM are exhibiting — a pre-qualified prospecting list you can work the same trip.",
      citations: [ev("BuildRight Materials — Booth W2201")],
    },
  ],
  missingEvidence: [
    "Full exhibitor PDF not yet ingested — using the public directory snapshot.",
  ],
  createdAt: NOW - 2900000,
};

const demoJobs: Job[] = [
  { _id: "demo_job_ingest", eventId: ATTEND_EVENT_ID, step: "ingest", status: "completed", message: "Exhibitor directory loaded", progress: 100, updatedAt: NOW - 3500000 },
  { _id: "demo_job_extract", eventId: ATTEND_EVENT_ID, step: "extract", status: "completed", message: "142 exhibitors parsed", progress: 100, updatedAt: NOW - 3400000 },
  { _id: "demo_job_match", eventId: ATTEND_EVENT_ID, step: "match", status: "completed", message: "18 of your accounts matched", progress: 100, updatedAt: NOW - 3200000 },
  { _id: "demo_job_score", eventId: ATTEND_EVENT_ID, step: "score", status: "completed", message: "Recommendation: attend", progress: 100, updatedAt: NOW - 3000000 },
  { _id: "demo_job_memo", eventId: ATTEND_EVENT_ID, step: "memo", status: "completed", message: "Attend — don't sponsor over $12K", progress: 100, updatedAt: NOW - 2900000 },
  { _id: "demo_job_enrich", eventId: ATTEND_EVENT_ID, step: "enrich", status: "completed", message: "8 attendees · 5 contacts", progress: 100, updatedAt: NOW - 2800000 },
  { _id: "demo_job_outreach", eventId: ATTEND_EVENT_ID, step: "outreach", status: "completed", message: "4 drafts ready", progress: 100, updatedAt: NOW - 2750000 },
];

// ---------------------------------------------------------------------------
// Bundles + scenarios
// ---------------------------------------------------------------------------

export const demoAttendBundle: SchruteDemoBundle = {
  revenueProfile: demoRevenueProfile,
  crmAccounts: demoCrmAccounts,
  event: demoAttendEvent,
  sourceDocuments: demoSourceDocuments,
  eventFacts: [],
  eventCompanies: demoEventCompanies,
  accountMatches: demoAllMatches,
  eventScore: demoAttendScore,
  decisionMemo: demoAttendMemo,
  contacts: demoContacts,
  outreachDrafts: demoOutreachDrafts,
  jobs: demoJobs,
};

// ---- Skip scenario (proves Schrute says no when the math doesn't work) ----

const SKIP_ASSUMPTIONS = { ...ATTEND_ASSUMPTIONS, sponsorCost: 22000 };

export const demoSkipEvent: Event = {
  _id: SKIP_EVENT_ID,
  name: "Regional Builders Expo 2026",
  slug: "regional-builders-expo-2026",
  startDate: "2026-03-11",
  endDate: "2026-03-12",
  location: "Columbus, OH",
  sponsorQuote: 22000,
  revenueProfileId: PROFILE_ID,
  assumptions: SKIP_ASSUMPTIONS,
  createdAt: NOW - 3600000,
};

const skipMatches: AccountMatch[] = [
  {
    _id: "demo_skip_match_kiewit",
    eventId: SKIP_EVENT_ID,
    tier: "tier1_crm",
    crmAccountId: "demo_crm_kiewit",
    companyName: "Kiewit",
    domain: "kiewit.com",
    role: "exhibitor",
    boothOrSession: "B12",
    fitScore: 0.72,
    confidence: 0.58,
    evidence: [
      {
        sourceDocumentId: "demo_source_regional",
        sourceUrl: "https://regionalbuildersexpo.com/exhibitors",
        quote: "Kiewit — Booth B12",
        factType: "exhibitor",
        confidence: 0.58,
      },
    ],
    matchedOppValue: 45000,
    rank: 1,
    createdAt: NOW - 3200000,
  },
  {
    _id: "demo_skip_match_netnew1",
    eventId: SKIP_EVENT_ID,
    tier: "tier2_icp",
    companyName: "Midwest Concrete Supply",
    role: "exhibitor",
    boothOrSession: "A04",
    fitScore: 0.55,
    confidence: 0.6,
    evidence: [
      {
        sourceDocumentId: "demo_source_regional",
        sourceUrl: "https://regionalbuildersexpo.com/exhibitors",
        quote: "Midwest Concrete Supply — Booth A04",
        factType: "exhibitor",
        confidence: 0.6,
      },
    ],
    rank: 2,
    createdAt: NOW - 3200000,
  },
];

export const demoSkipScore: EventScore = {
  _id: "demo_score_regional",
  eventId: SKIP_EVENT_ID,
  totalEventCost: 30000,
  revenuePerQualifiedMeeting: 6213,
  requiredQualifiedMeetings: 5,
  sponsorCap: 0,
  matchedPipelineValue: 45000,
  tier1MatchCount: 1,
  tier2MatchCount: 1,
  recommendation: "skip",
  subScores: {
    pipelinePresence: 0.21,
    evidenceQuality: 0.59,
    costEfficiency: 0.17,
    icpDensity: 0.34,
  },
  assumptions: SKIP_ASSUMPTIONS,
  rationale: [
    "Only 1 Tier-1 CRM account present, with moderate exhibitor evidence.",
    "Matched pipeline is $45K — far below the $30K all-in cost at the required 5 meetings.",
    "High logo density, low pipeline concentration. Skip unless the goal is competitor-watching.",
  ],
  createdAt: NOW - 3000000,
};

export const demoSkipMemo: DecisionMemo = {
  _id: "demo_memo_regional",
  eventId: SKIP_EVENT_ID,
  eventScoreId: "demo_score_regional",
  headline: "Skip — popular, not profitable",
  verdict: "skip",
  sections: [
    {
      title: "Thin pipeline presence",
      body: "Only 1 of your accounts is confirmed here, with $45K of open pipeline. The booth needs 5 qualified meetings to break even and the accounts to support that aren't on this floor.",
      citations: [
        {
          sourceDocumentId: "demo_source_regional",
          sourceUrl: "https://regionalbuildersexpo.com/exhibitors",
          quote: "Kiewit — Booth B12",
          factType: "exhibitor",
          confidence: 0.58,
        },
      ],
    },
    {
      title: "The call",
      body: "Skip the $22K booth. If a rep is already in Columbus, have them stop by — but don't commit spend to this one.",
      citations: [],
    },
  ],
  missingEvidence: [
    "Exhibitor list is partial — re-run if a fuller directory becomes available.",
  ],
  createdAt: NOW - 2900000,
};

const skipJobs: Job[] = [
  { _id: "demo_skip_job_ingest", eventId: SKIP_EVENT_ID, step: "ingest", status: "completed", progress: 100, updatedAt: NOW - 3500000 },
  { _id: "demo_skip_job_extract", eventId: SKIP_EVENT_ID, step: "extract", status: "completed", message: "61 exhibitors parsed", progress: 100, updatedAt: NOW - 3400000 },
  { _id: "demo_skip_job_match", eventId: SKIP_EVENT_ID, step: "match", status: "completed", message: "2 accounts matched", progress: 100, updatedAt: NOW - 3200000 },
  { _id: "demo_skip_job_score", eventId: SKIP_EVENT_ID, step: "score", status: "completed", message: "Recommendation: skip", progress: 100, updatedAt: NOW - 3000000 },
  { _id: "demo_skip_job_memo", eventId: SKIP_EVENT_ID, step: "memo", status: "completed", message: "Skip — popular, not profitable", progress: 100, updatedAt: NOW - 2900000 },
  { _id: "demo_skip_job_enrich", eventId: SKIP_EVENT_ID, step: "enrich", status: "skipped", progress: 0, updatedAt: NOW - 2800000 },
  { _id: "demo_skip_job_outreach", eventId: SKIP_EVENT_ID, step: "outreach", status: "skipped", progress: 0, updatedAt: NOW - 2750000 },
];

export const demoSkipBundle: SchruteDemoBundle = {
  revenueProfile: demoRevenueProfile,
  crmAccounts: demoCrmAccounts,
  event: demoSkipEvent,
  sourceDocuments: [],
  eventFacts: [],
  eventCompanies: [],
  accountMatches: skipMatches,
  eventScore: demoSkipScore,
  decisionMemo: demoSkipMemo,
  contacts: [],
  outreachDrafts: [],
  jobs: skipJobs,
};

// ---------------------------------------------------------------------------
// Likely attendees (social signals)
//
// Honest framing: these are people who PUBLICLY POSTED about going. We quote the
// post and attach a confidence. We never claim to know who'll show up — we
// surface self-declared intent and tie it back to a matched account.
// (Demo data; real version swaps in a social-data API. LinkedIn scraping is
// ToS-sensitive, so this is intentionally a clean seam, not live scraping.)
// ---------------------------------------------------------------------------

export type AttendeeNetwork = "linkedin" | "x" | "web";

export type LikelyAttendee = {
  id: string;
  fullName: string;
  title: string;
  companyName: string;
  /** Ties back to an AccountMatch (`demo_match_<key>`) when the company matched. */
  accountMatchId?: string;
  matchTier?: MatchTier;
  network: AttendeeNetwork;
  postQuote: string;
  postedAt: string;
  /** 0–1, how explicit the attendance signal is. Kept for ranking; not shown. */
  confidence: number;
  profileUrl: string;
  /** Fiber-sourced enrichment (best-effort). */
  email?: string;
  emailStatus?: string;
  phone?: string;
  location?: string;
  enrichedTitle?: string;
  /** One-line AI rationale for why this person is a good match. */
  matchReason?: string;
};

export const demoAttendees: LikelyAttendee[] = [
  {
    id: "att_turner_marcus",
    fullName: "Marcus Hill",
    title: "Senior Project Manager",
    companyName: "Turner Construction",
    accountMatchId: "demo_match_turner",
    matchTier: "tier1_crm",
    network: "linkedin",
    postQuote:
      "Heading to World of Concrete next week 🚧 Stop by Booth N1234 if you want to talk jobsite safety tech and what we're rolling out in 2026. #WOC2026",
    postedAt: "2026-01-12",
    confidence: 0.96,
    profileUrl: "https://www.linkedin.com/in/marcus-hill-turner",
    matchReason:
      "Posted about attending World of Concrete — CRM account; warm outreach while they're planning the trip.",
  },
  {
    id: "att_skanska_elena",
    fullName: "Elena Park",
    title: "EHS Program Lead",
    companyName: "Skanska USA",
    accountMatchId: "demo_match_skanska",
    matchTier: "tier1_crm",
    network: "linkedin",
    postQuote:
      "Excited for #WorldOfConcrete! I'll be at Booth S4521 talking through our incident-reporting rollout. Always happy to swap notes with other EHS folks.",
    postedAt: "2026-01-10",
    confidence: 0.94,
    profileUrl: "https://www.linkedin.com/in/elena-park-ehs",
    matchReason:
      "CRM account with open pipeline; posted about WoC booth S4521 — book before the floor gets loud.",
  },
  {
    id: "att_mccarthy_dwight",
    fullName: "Dwight Powell",
    title: "VP Field Operations",
    companyName: "McCarthy Building Companies",
    accountMatchId: "demo_match_mccarthy",
    matchTier: "tier1_crm",
    network: "linkedin",
    postQuote:
      "Proud to be a Gold Sponsor at World of Concrete 2026. Come find the McCarthy team on the floor — let's talk safety culture. ☕",
    postedAt: "2026-01-08",
    confidence: 0.92,
    profileUrl: "https://www.linkedin.com/in/dwight-powell-mccarthy",
    matchReason:
      "Gold sponsor posted about WoC — active CRM account; prioritize a booth walk-by.",
  },
  {
    id: "att_dpr_tom",
    fullName: "Tom Reyes",
    title: "Director of EHS",
    companyName: "DPR Construction",
    accountMatchId: "demo_match_dpr",
    matchTier: "tier1_crm",
    network: "x",
    postQuote:
      "Walking the floor at WoC this year — DPR's at C2210. DM me if you want to connect on safety tooling.",
    postedAt: "2026-01-14",
    confidence: 0.83,
    profileUrl: "https://x.com/tomreyes_ehs",
  },
  {
    id: "att_buildright_priya",
    fullName: "Priya Shah",
    title: "Head of Field Operations",
    companyName: "BuildRight Materials",
    accountMatchId: "demo_match_buildright",
    matchTier: "tier2_icp",
    network: "linkedin",
    postQuote:
      "First time exhibiting at World of Concrete! 🎉 Booth W2201 — come say hi and see what we've been building. #construction #WOC2026",
    postedAt: "2026-01-09",
    confidence: 0.9,
    profileUrl: "https://www.linkedin.com/in/priya-shah-buildright",
  },
  {
    id: "att_gilbane_sandra",
    fullName: "Sandra Lowe",
    title: "Project Executive",
    companyName: "Gilbane Building Company",
    accountMatchId: "demo_match_gilbane",
    matchTier: "tier1_crm",
    network: "linkedin",
    postQuote:
      "Counting down to World of Concrete. Who else from the GC world is going to be in Vegas? Let's grab coffee. ☕",
    postedAt: "2026-01-11",
    confidence: 0.61,
    profileUrl: "https://www.linkedin.com/in/sandra-lowe-gilbane",
  },
  {
    id: "att_sitesecure_andre",
    fullName: "André Castro",
    title: "Co-founder & CEO",
    companyName: "SiteSecure Systems",
    accountMatchId: "demo_match_sitesecure",
    matchTier: "tier2_icp",
    network: "linkedin",
    postQuote:
      "We're exhibiting at #WOC2026! Booth C3015. If safety + IoT on the jobsite is your thing, let's talk.",
    postedAt: "2026-01-07",
    confidence: 0.88,
    profileUrl: "https://www.linkedin.com/in/andre-castro-sitesecure",
  },
  {
    id: "att_clark_renee",
    fullName: "Renee Walsh",
    title: "VP Safety",
    companyName: "Clark Construction",
    accountMatchId: "demo_match_clark",
    matchTier: "tier1_crm",
    network: "linkedin",
    postQuote:
      "Looking forward to World of Concrete — Clark will be at C1102. Reach out if you want time on the calendar before the show fills up.",
    postedAt: "2026-01-13",
    confidence: 0.87,
    profileUrl: "https://www.linkedin.com/in/renee-walsh-clark",
  },
];

const demoSkipAttendees: LikelyAttendee[] = [
  {
    id: "att_kiewit_glenn",
    fullName: "Glenn Foster",
    title: "Safety Coordinator",
    companyName: "Kiewit",
    accountMatchId: "demo_skip_match_kiewit",
    matchTier: "tier1_crm",
    network: "linkedin",
    postQuote:
      "Might swing by the Regional Builders Expo in Columbus if the schedule allows. Anyone else going?",
    postedAt: "2026-03-02",
    confidence: 0.42,
    profileUrl: "https://www.linkedin.com/in/glenn-foster-kiewit",
  },
];

export type DemoScenarioKey = "attend" | "skip";

export const DEMO_SCENARIOS: Record<
  DemoScenarioKey,
  { label: string; bundle: SchruteDemoBundle; attendees: LikelyAttendee[] }
> = {
  attend: {
    label: "World of Concrete (Attend)",
    bundle: demoAttendBundle,
    attendees: demoAttendees,
  },
  skip: {
    label: "Regional Builders Expo (Skip)",
    bundle: demoSkipBundle,
    attendees: demoSkipAttendees,
  },
};

// ---------------------------------------------------------------------------
// Portfolio Planner (V2 teaser) — pipeline concentration across events
// ---------------------------------------------------------------------------

export type PortfolioEvent = {
  id: string;
  name: string;
  location: string;
  region: string;
  dates: string;
  matchedAccounts: number;
  openOpps: number;
  matchedPipeline: number;
  verdict: "attend" | "sponsor" | "side_event" | "skip";
};

export const PORTFOLIO_EVENTS: PortfolioEvent[] = [
  { id: "woc", name: "World of Concrete", location: "Las Vegas, NV", region: "US West", dates: "Jan 20–22", matchedAccounts: 18, openOpps: 6, matchedPipeline: 640000, verdict: "attend" },
  { id: "assp", name: "ASSP Safety 2026", location: "Denver, CO", region: "US West", dates: "Jun 8–10", matchedAccounts: 12, openOpps: 4, matchedPipeline: 410000, verdict: "sponsor" },
  { id: "conexpo", name: "CONEXPO Regional", location: "Phoenix, AZ", region: "US West", dates: "Feb 18–20", matchedAccounts: 9, openOpps: 3, matchedPipeline: 285000, verdict: "attend" },
  { id: "midwest", name: "Midwest Construction Summit", location: "Chicago, IL", region: "US Midwest", dates: "Apr 14–15", matchedAccounts: 7, openOpps: 2, matchedPipeline: 160000, verdict: "side_event" },
  { id: "regional", name: "Regional Builders Expo", location: "Columbus, OH", region: "US Midwest", dates: "Mar 11–12", matchedAccounts: 2, openOpps: 1, matchedPipeline: 45000, verdict: "skip" },
  { id: "southeast", name: "Southeast Build Show", location: "Atlanta, GA", region: "US South", dates: "May 6–7", matchedAccounts: 4, openOpps: 1, matchedPipeline: 90000, verdict: "skip" },
];
