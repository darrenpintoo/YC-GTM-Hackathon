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

export const DEFAULT_UNDERWRITING_ASSUMPTIONS: UnderwritingAssumptions = {
  sponsorCost: 25000,
  travelCost: 6000,
  repTimeCost: 4000,
  avgDealSize: 85000,
  meetingToOppRate: 0.35,
  winRate: 0.22,
  riskDiscount: 0.85,
  captureRate: 0.12,
};
