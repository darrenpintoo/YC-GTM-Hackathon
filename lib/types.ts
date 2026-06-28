/**
 * Schrute shared types — mirror of convex/schema.ts for client-side mocks and UI.
 * IDs are plain strings in mocks; Convex generates branded Id<> at runtime.
 */

export type SchruteId<T extends string = string> = string & { __table?: T };

export type EvidenceFactType =
  | "exhibitor"
  | "sponsor"
  | "speaker"
  | "agenda"
  | "other"
  | "unknown";

export type Evidence = {
  sourceDocumentId: SchruteId<"sourceDocument">;
  sourceUrl: string;
  quote: string;
  factType: EvidenceFactType;
  confidence: number;
};

export type MatchTier = "tier1_crm" | "tier2_icp";

export type CrmAccountType = "closed_won" | "open_opp" | "target" | "other";

export type EventCompanyRole = "exhibitor" | "sponsor" | "speaker" | "unknown";

export type Recommendation =
  | "sponsor"
  | "attend"
  | "side_event"
  | "ask_for_data"
  | "skip";

export type JobStep =
  | "ingest"
  | "extract"
  | "match"
  | "score"
  | "memo"
  | "enrich"
  | "outreach";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type SourceDocumentKind = "url" | "paste" | "pdf" | "snapshot";

export type ContactVerification = "verified" | "likely" | "unknown";

export type UnderwritingAssumptions = {
  sponsorCost: number;
  travelCost: number;
  repTimeCost: number;
  avgDealSize: number;
  meetingToOppRate: number;
  winRate: number;
  riskDiscount: number;
  captureRate: number;
};

export type DealSizeCluster = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type RevenueProfile = {
  _id: SchruteId<"revenueProfile">;
  name: string;
  industries: string[];
  buyerTitles: string[];
  dealSizeClusters: DealSizeCluster[];
  geographies: string[];
  keywords: string[];
  closedWonPatterns: string[];
  rawAiJson?: string;
  createdAt: number;
  updatedAt?: number;
};

export type CrmAccount = {
  _id: SchruteId<"crmAccount">;
  revenueProfileId: SchruteId<"revenueProfile">;
  companyName: string;
  domain?: string;
  accountType: CrmAccountType;
  stage?: string;
  dealSize?: number;
  industry?: string;
  region?: string;
  buyerTitle?: string;
  openOppValue?: number;
  createdAt: number;
};

export type Event = {
  _id: SchruteId<"event">;
  name: string;
  slug: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  sponsorQuote?: number;
  revenueProfileId?: SchruteId<"revenueProfile">;
  assumptions?: UnderwritingAssumptions;
  createdAt: number;
};

export type SourceDocument = {
  _id: SchruteId<"sourceDocument">;
  eventId: SchruteId<"event">;
  kind: SourceDocumentKind;
  url?: string;
  title?: string;
  /** Research bucket: sponsors | exhibitors | speakers | program | news | event | other | past_edition */
  category?: string;
  /** True when this page is a past edition / indirect source (not this year's event). */
  recurring?: boolean;
  editionLabel?: string;
  textContent: string;
  contentHash: string;
  fetchedAt: number;
};

export type EventFact = {
  _id: SchruteId<"eventFact">;
  eventId: SchruteId<"event">;
  sourceDocumentId: SchruteId<"sourceDocument">;
  factType:
    | "exhibitor_list"
    | "sponsor_list"
    | "speaker_list"
    | "agenda"
    | "booth_map"
    | "other"
    | "unknown";
  label: string;
  value: string;
  quote: string;
  confidence: number;
  createdAt: number;
};

export type EventCompany = {
  _id: SchruteId<"eventCompany">;
  eventId: SchruteId<"event">;
  sourceDocumentId: SchruteId<"sourceDocument">;
  companyName: string;
  normalizedName?: string;
  domain?: string;
  role: EventCompanyRole;
  boothOrSession?: string;
  quote: string;
  confidence: number;
  presence?: "confirmed" | "recurring";
  editionLabel?: string;
  contactName?: string;
  contactTitle?: string;
  contactQuote?: string;
  createdAt: number;
};

/** Confirmed company presence at an event — never a personal-attendance claim. */
export type AccountMatch = {
  _id: SchruteId<"accountMatch">;
  eventId: SchruteId<"event">;
  tier: MatchTier;
  crmAccountId?: SchruteId<"crmAccount">;
  companyName: string;
  domain?: string;
  role: EventCompanyRole;
  boothOrSession?: string;
  fitScore: number;
  confidence: number;
  presence?: "confirmed" | "recurring";
  editionLabel?: string;
  contactName?: string;
  contactTitle?: string;
  contactQuote?: string;
  evidence: Evidence[];
  matchedOppValue?: number;
  eventCompanyId?: SchruteId<"eventCompany">;
  rank?: number;
  createdAt: number;
};

export type EventScoreSubScores = {
  pipelinePresence: number;
  evidenceQuality: number;
  costEfficiency: number;
  icpDensity: number;
};

export type EventScore = {
  _id: SchruteId<"eventScore">;
  eventId: SchruteId<"event">;
  totalEventCost: number;
  revenuePerQualifiedMeeting: number;
  requiredQualifiedMeetings: number;
  sponsorCap: number;
  matchedPipelineValue: number;
  tier1MatchCount: number;
  tier2MatchCount: number;
  recommendation: Recommendation;
  subScores: EventScoreSubScores;
  assumptions: UnderwritingAssumptions;
  rationale: string[];
  createdAt: number;
};

export type DecisionMemoSection = {
  title: string;
  body: string;
  citations: Evidence[];
};

export type DecisionMemo = {
  _id: SchruteId<"decisionMemo">;
  eventId: SchruteId<"event">;
  eventScoreId: SchruteId<"eventScore">;
  headline: string;
  verdict: Recommendation;
  sections: DecisionMemoSection[];
  missingEvidence: string[];
  rawAiJson?: string;
  createdAt: number;
};

export type Contact = {
  _id: SchruteId<"contact">;
  accountMatchId: SchruteId<"accountMatch">;
  eventId: SchruteId<"event">;
  fullName: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  verification: ContactVerification;
  fiberRawJson?: string;
  createdAt: number;
};

export type OutreachDraft = {
  _id: SchruteId<"outreachDraft">;
  accountMatchId: SchruteId<"accountMatch">;
  contactId?: SchruteId<"contact">;
  eventId: SchruteId<"event">;
  subject: string;
  body: string;
  tone?: string;
  rawAiJson?: string;
  createdAt: number;
};

export type Job = {
  _id: SchruteId<"jobs">;
  eventId: SchruteId<"event">;
  step: JobStep;
  status: JobStatus;
  message?: string;
  progress?: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  updatedAt: number;
};

/** Full demo bundle for UI development without backend. */
export type SchruteDemoBundle = {
  revenueProfile: RevenueProfile;
  crmAccounts: CrmAccount[];
  event: Event;
  sourceDocuments: SourceDocument[];
  eventFacts: EventFact[];
  eventCompanies: EventCompany[];
  accountMatches: AccountMatch[];
  eventScore: EventScore;
  decisionMemo: DecisionMemo;
  contacts: Contact[];
  outreachDrafts: OutreachDraft[];
  jobs: Job[];
};

/** Seam: company resolution — Nehal can swap Fiber behind this interface. */
export type ResolvedCompany = {
  companyName: string;
  domain?: string;
  confidence: number;
  source: "domain_lookup" | "fiber" | "fuzzy_name" | "unknown";
};

export type ResolveCompanyFn = (
  companyName: string,
  hints?: { domain?: string },
) => Promise<ResolvedCompany>;

export const CORE_JOB_STEPS: JobStep[] = [
  "ingest",
  "extract",
  "match",
  "score",
  "memo",
];

export const SIDECAR_JOB_STEPS: JobStep[] = ["enrich", "outreach"];

export const ALL_JOB_STEPS: JobStep[] = [
  ...CORE_JOB_STEPS,
  ...SIDECAR_JOB_STEPS,
];
