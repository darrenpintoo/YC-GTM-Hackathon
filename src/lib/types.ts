// ============================================================
// Schrute AI — core domain types
// ============================================================

export type SignalType =
  | "attendee" // direct: public attendee list, conference app
  | "company-presence" // sponsors, exhibitors, speakers, partners
  | "historical" // past recaps, old sponsor PDFs, photos
  | "social" // LinkedIn "see you at...", announcements
  | "icp-proxy"; // agenda topics, titles, certifications, region

export type Verdict = "attend" | "sponsor" | "reps-only" | "maybe" | "skip";

export interface EventSignal {
  id: string;
  type: SignalType;
  /** the company / org this signal points to (if any) */
  company?: string;
  /** short label of the company, e.g. "Series B · Logistics SaaS" */
  descriptor?: string;
  /** the role this org plays at the event, e.g. "Platinum Sponsor", "Speaker" */
  role?: string;
  /** human-readable evidence string */
  evidence: string;
  /** where we found it */
  source: string;
  sourceLabel?: string;
  /** 0..1 — how strongly this company resembles the ICP / closed-won set */
  matchToICP: number;
  /** 0..1 — how confident we are this signal is real / current */
  confidence: number;
  /** the closed-won account this company looks like, if matched */
  lookalikeOf?: string;
}

export interface EventScore {
  total: number; // 0..100
  icpFit: number; // 0..30
  accountSignal: number; // 0..25
  buyerDensity: number; // 0..15
  pipelineUpside: number; // 0..15
  costRisk: number; // 0..10
  evidenceConfidence: number; // 0..5
}

export interface DecisionMemo {
  verdict: Verdict;
  headline: string; // blunt one-liner
  rationale: string;
  sponsorThreshold?: string; // e.g. "$14K"
  successCriteria: string; // e.g. "6 qualified meetings"
  expectedPipeline?: string; // e.g. "$180K–$320K"
  missingData: string[];
  nextAction: string;
}

export interface EventEval {
  id: string;
  name: string;
  url: string;
  location: string;
  date: string;
  category: string;
  costEstimate: string; // booth / sponsorship band
  blurb: string;
  signals: EventSignal[];
  score: EventScore;
  memo: DecisionMemo;
}

export interface RevenueProfile {
  company: string;
  tagline: string;
  bestFitIndustries: string[];
  buyerPersonas: string[];
  dealSizeBand: string;
  geographies: string[];
  /** named closed-won accounts that define "who we win" */
  closedWonLookalikes: string[];
  keywords: string[];
  eventGoal: string;
}

export interface Workspace {
  id: string;
  name: string;
  /** short context for the workspace switcher */
  context: string;
  profile: RevenueProfile;
  events: EventEval[];
}
