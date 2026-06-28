import type {
  EventScore,
  EventSignal,
  SignalType,
  Verdict,
} from "./types";

// ============================================================
// Deterministic, explainable scoring engine.
// The NUMBER is math; the RATIONALE is AI. Confidence != fit.
// ============================================================

export const WEIGHTS = {
  icpFit: 30,
  accountSignal: 25,
  buyerDensity: 15,
  pipelineUpside: 15,
  costRisk: 10,
  evidenceConfidence: 5,
} as const;

export const SUBSCORE_META: {
  key: keyof typeof WEIGHTS;
  label: string;
  blurb: string;
}[] = [
  { key: "icpFit", label: "ICP Fit", blurb: "Agenda, industry, region & roles vs. your Revenue Profile" },
  { key: "accountSignal", label: "Account Signal", blurb: "Sponsors / exhibitors that look like your closed-won set" },
  { key: "buyerDensity", label: "Buyer Density", blurb: "Decision-makers & operators — not vendors selling to vendors" },
  { key: "pipelineUpside", label: "Pipeline Upside", blurb: "Expected value vs. rep time and likely cost" },
  { key: "costRisk", label: "Cost Risk", blurb: "Booth, travel & time vs. reasonable break-even (higher = safer)" },
  { key: "evidenceConfidence", label: "Evidence Confidence", blurb: "How complete & reliable the public evidence is" },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const buyerTypes: SignalType[] = ["attendee", "icp-proxy"];

/**
 * Derive a Schrute Score from raw signals. Used by the live analyze path.
 * Demo events ship hand-tuned scores for narrative control.
 */
export function scoreFromSignals(
  signals: EventSignal[],
  opts: { costRisk?: number } = {},
): EventScore {
  const matches = signals.map((s) => s.matchToICP);
  const confidences = signals.map((s) => s.confidence);
  const lookalikes = signals.filter((s) => s.lookalikeOf);
  const buyerSignals = signals.filter((s) => buyerTypes.includes(s.type));

  const icpFit = clamp(avg(matches) * WEIGHTS.icpFit, 0, WEIGHTS.icpFit);

  // strength * volume, saturating around ~10 strong account signals
  const accountStrength = avg(
    signals
      .filter((s) => s.type === "company-presence" || s.type === "attendee")
      .map((s) => s.matchToICP),
  );
  const accountVolume = clamp(lookalikes.length / 10, 0, 1);
  const accountSignal = clamp(
    (accountStrength * 0.6 + accountVolume * 0.4) * WEIGHTS.accountSignal,
    0,
    WEIGHTS.accountSignal,
  );

  const buyerDensity = clamp(
    avg(buyerSignals.map((s) => s.matchToICP)) * WEIGHTS.buyerDensity,
    0,
    WEIGHTS.buyerDensity,
  );

  const pipelineUpside = clamp(
    (clamp(lookalikes.length / 8, 0, 1) * 0.7 + accountStrength * 0.3) *
      WEIGHTS.pipelineUpside,
    0,
    WEIGHTS.pipelineUpside,
  );

  const costRisk = clamp(opts.costRisk ?? WEIGHTS.costRisk * 0.6, 0, WEIGHTS.costRisk);

  const evidenceConfidence = clamp(
    avg(confidences) * WEIGHTS.evidenceConfidence,
    0,
    WEIGHTS.evidenceConfidence,
  );

  const total = Math.round(
    icpFit + accountSignal + buyerDensity + pipelineUpside + costRisk + evidenceConfidence,
  );

  return {
    total,
    icpFit: Math.round(icpFit),
    accountSignal: Math.round(accountSignal),
    buyerDensity: Math.round(buyerDensity),
    pipelineUpside: Math.round(pipelineUpside),
    costRisk: Math.round(costRisk),
    evidenceConfidence: Math.round(evidenceConfidence),
  };
}

/** average evidence confidence as a 0..1 number */
export function evidenceConfidence(signals: EventSignal[]): number {
  return avg(signals.map((s) => s.confidence));
}

export function confidenceLabel(c: number): "low" | "medium" | "medium-high" | "high" {
  if (c >= 0.8) return "high";
  if (c >= 0.62) return "medium-high";
  if (c >= 0.42) return "medium";
  return "low";
}

export function scoreTone(total: number): "go" | "caution" | "skip" {
  if (total >= 70) return "go";
  if (total >= 50) return "caution";
  return "skip";
}

export const VERDICT_META: Record<
  Verdict,
  { label: string; tone: "go" | "caution" | "skip" }
> = {
  attend: { label: "Attend", tone: "go" },
  sponsor: { label: "Sponsor", tone: "go" },
  "reps-only": { label: "Send Reps Only", tone: "caution" },
  maybe: { label: "Maybe — Get Data", tone: "caution" },
  skip: { label: "Skip", tone: "skip" },
};

export const SIGNAL_META: Record<
  SignalType,
  { label: string; short: string; blurb: string }
> = {
  attendee: {
    label: "Direct attendee",
    short: "Attendee",
    blurb: "Public lists, conference apps, sponsor portals — strongest evidence",
  },
  "company-presence": {
    label: "Company presence",
    short: "Presence",
    blurb: "Sponsors, exhibitors, speakers — strong proxy for participation",
  },
  historical: {
    label: "Historical",
    short: "Historical",
    blurb: "Past recaps, old sponsor PDFs, photos — recurring audience",
  },
  social: {
    label: "Social intent",
    short: "Social",
    blurb: "“See you at…” posts, announcements — live participation",
  },
  "icp-proxy": {
    label: "ICP proxy",
    short: "ICP proxy",
    blurb: "Agenda topics, titles, region — infers buyer density",
  },
};
