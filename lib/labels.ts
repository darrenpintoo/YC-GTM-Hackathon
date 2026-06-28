import type {
  ContactVerification,
  EventCompanyRole,
  MatchTier,
  Recommendation,
} from "@/lib/types";

export const RECOMMENDATION_META: Record<
  Recommendation,
  { label: string; tone: "success" | "warning" | "info" | "danger" }
> = {
  sponsor: { label: "Sponsor", tone: "success" },
  attend: { label: "Attend", tone: "success" },
  side_event: { label: "Side event", tone: "info" },
  ask_for_data: { label: "Ask for data", tone: "warning" },
  skip: { label: "Skip", tone: "danger" },
};

export const TIER_META: Record<
  MatchTier,
  { label: string; short: string; blurb: string }
> = {
  tier1_crm: {
    label: "Tier 1 · In your CRM",
    short: "Tier 1",
    blurb: "Already in your CRM — open opps, targets, closed-won.",
  },
  tier2_icp: {
    label: "Tier 2 · Net-new ICP",
    short: "Tier 2",
    blurb: "Strong-fit companies not yet in your CRM. Pre-qualified prospects.",
  },
};

export const ROLE_LABEL: Record<EventCompanyRole, string> = {
  exhibitor: "Exhibitor",
  sponsor: "Sponsor",
  speaker: "Speaker",
  unknown: "Present",
};

export const VERIFICATION_META: Record<
  ContactVerification,
  { label: string; tone: "success" | "warning" | "muted" }
> = {
  verified: { label: "Verified", tone: "success" },
  likely: { label: "Likely", tone: "warning" },
  unknown: { label: "Unverified", tone: "muted" },
};
