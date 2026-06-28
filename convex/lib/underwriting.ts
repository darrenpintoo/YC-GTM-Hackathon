import type { UnderwritingAssumptions } from "./defaults";

type Recommendation =
  | "sponsor"
  | "attend"
  | "side_event"
  | "ask_for_data"
  | "skip";

export type UnderwritingInput = {
  assumptions: UnderwritingAssumptions;
  matchedPipelineValue: number;
  tier1MatchCount: number;
  tier2MatchCount: number;
  openOppMatchCount: number;
  avgMatchConfidence: number;
  sponsorQuote?: number;
};

export type UnderwritingResult = {
  totalEventCost: number;
  revenuePerQualifiedMeeting: number;
  requiredQualifiedMeetings: number;
  sponsorCap: number;
  recommendation: Recommendation;
  subScores: {
    pipelinePresence: number;
    evidenceQuality: number;
    costEfficiency: number;
    icpDensity: number;
  };
  rationale: string[];
};

export function computeUnderwriting(input: UnderwritingInput): UnderwritingResult {
  const { assumptions } = input;
  const sponsorCost = input.sponsorQuote ?? assumptions.sponsorCost;

  const totalEventCost =
    sponsorCost + assumptions.travelCost + assumptions.repTimeCost;

  const revenuePerQualifiedMeeting =
    assumptions.avgDealSize *
    assumptions.meetingToOppRate *
    assumptions.winRate *
    assumptions.riskDiscount;

  const requiredQualifiedMeetings =
    revenuePerQualifiedMeeting > 0
      ? Math.ceil(totalEventCost / revenuePerQualifiedMeeting)
      : 999;

  const sponsorCap = Math.max(
    0,
    input.matchedPipelineValue * assumptions.captureRate -
      assumptions.travelCost -
      assumptions.repTimeCost,
  );

  const pipelinePresence = clamp01(
    input.tier1MatchCount / 7 + input.openOppMatchCount * 0.15,
  );
  const evidenceQuality = clamp01(input.avgMatchConfidence);
  const costEfficiency =
    requiredQualifiedMeetings > 0
      ? clamp01(input.openOppMatchCount / requiredQualifiedMeetings)
      : 0;
  const icpDensity = clamp01(
    (input.tier1MatchCount + input.tier2MatchCount * 0.5) / 15,
  );

  const rationale: string[] = [
    `${input.tier1MatchCount} Tier-1 CRM accounts confirmed present.`,
    `Matched open pipeline: $${Math.round(input.matchedPipelineValue).toLocaleString()}.`,
    `Break-even requires ${requiredQualifiedMeetings} qualified meetings at $${Math.round(totalEventCost).toLocaleString()} all-in.`,
    `Sponsor cap anchored to pipeline: $${Math.round(sponsorCap).toLocaleString()}.`,
  ];

  const recommendation = pickRecommendation({
    sponsorCost,
    sponsorCap,
    tier1MatchCount: input.tier1MatchCount,
    openOppMatchCount: input.openOppMatchCount,
    requiredQualifiedMeetings,
    avgMatchConfidence: input.avgMatchConfidence,
    matchedPipelineValue: input.matchedPipelineValue,
    rationale,
  });

  return {
    totalEventCost,
    revenuePerQualifiedMeeting,
    requiredQualifiedMeetings,
    sponsorCap,
    recommendation,
    subScores: {
      pipelinePresence,
      evidenceQuality,
      costEfficiency,
      icpDensity,
    },
    rationale,
  };
}

function pickRecommendation(args: {
  sponsorCost: number;
  sponsorCap: number;
  tier1MatchCount: number;
  openOppMatchCount: number;
  requiredQualifiedMeetings: number;
  avgMatchConfidence: number;
  matchedPipelineValue: number;
  rationale: string[];
}): Recommendation {
  if (args.tier1MatchCount === 0 && args.matchedPipelineValue < 50000) {
    args.rationale.push("No Tier-1 CRM presence and weak pipeline match.");
    return "skip";
  }

  if (args.avgMatchConfidence < 0.45) {
    args.rationale.push("Evidence confidence is low — need better source documents.");
    return "ask_for_data";
  }

  if (
    args.openOppMatchCount >= args.requiredQualifiedMeetings &&
    args.sponsorCost > args.sponsorCap
  ) {
    args.rationale.push(
      "Open opps already on the floor — attend without overspending on sponsorship.",
    );
    return "attend";
  }

  if (args.sponsorCap >= args.sponsorCost && args.tier1MatchCount >= 4) {
    return "sponsor";
  }

  if (args.tier1MatchCount >= 2 && args.sponsorCost > args.sponsorCap) {
    return "side_event";
  }

  if (args.tier1MatchCount >= 1 && args.matchedPipelineValue >= 100000) {
    return "attend";
  }

  if (args.tier1MatchCount === 0) {
    return "skip";
  }

  return "attend";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
