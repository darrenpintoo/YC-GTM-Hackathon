"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { mockDemoBundle } from "@/lib/mocks";
import type {
  AccountMatch,
  Contact,
  CrmAccount,
  DecisionMemo,
  Event,
  EventCompany,
  EventScore,
  Job,
  OutreachDraft,
  RevenueProfile,
} from "@/lib/types";

/**
 * Data-adapter seam (Darren).
 *
 * The whole UI consumes this hook and never calls Convex directly, so we can
 * develop against `mockDemoBundle` and flip to live Convex with one env flag.
 *
 *   NEXT_PUBLIC_USE_MOCKS=false  -> live Convex (contracts.ts queries + seedDemo)
 *   (anything else / unset)      -> mock data (default)
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export const DEMO_EVENT_SLUG = "world-of-concrete-2026";

export type EventBundle = {
  event: Event;
  revenueProfile: RevenueProfile;
  crmAccounts: CrmAccount[];
  eventCompanies: EventCompany[];
  matches: AccountMatch[];
  score: EventScore | null;
  memo: DecisionMemo | null;
  contacts: Contact[];
  outreachDrafts: OutreachDraft[];
  jobs: Job[];
};

export type UseEventBundleResult = {
  /** Fully resolved bundle, or null when live data is not yet seeded. */
  bundle: EventBundle | null;
  /** True while live queries are still loading their first result. */
  isLoading: boolean;
  /** Convenience flag: a scored event with matches is available. */
  hasResults: boolean;
};

/** Stable shape used everywhere in the UI, regardless of data source. */
export function useEventBundle(): UseEventBundleResult {
  // Hooks must run unconditionally; in mock mode we pass "skip" so no network.
  const liveEvent = useQuery(
    api.events.getBySlug,
    USE_MOCKS ? "skip" : { slug: DEMO_EVENT_SLUG },
  );
  const eventId = liveEvent?._id;

  const liveMatches = useQuery(
    api.contracts.listAccountMatchesByEvent,
    !USE_MOCKS && eventId ? { eventId } : "skip",
  );
  const liveScore = useQuery(
    api.contracts.getEventScore,
    !USE_MOCKS && eventId ? { eventId } : "skip",
  );
  const liveMemo = useQuery(
    api.contracts.getDecisionMemo,
    !USE_MOCKS && eventId ? { eventId } : "skip",
  );
  const liveJobs = useQuery(
    api.contracts.listJobsByEvent,
    !USE_MOCKS && eventId ? { eventId } : "skip",
  );
  const liveCompanies = useQuery(
    api.ingest.listEventCompanies,
    !USE_MOCKS && eventId ? { eventId } : "skip",
  );
  const liveProfile = useQuery(
    api.profile.get,
    !USE_MOCKS && liveEvent?.revenueProfileId
      ? { profileId: liveEvent.revenueProfileId }
      : "skip",
  );
  const liveAccounts = useQuery(
    api.profile.listAccounts,
    !USE_MOCKS && liveEvent?.revenueProfileId
      ? { profileId: liveEvent.revenueProfileId }
      : "skip",
  );

  if (USE_MOCKS) {
    return {
      bundle: {
        event: mockDemoBundle.event,
        revenueProfile: mockDemoBundle.revenueProfile,
        crmAccounts: mockDemoBundle.crmAccounts,
        eventCompanies: mockDemoBundle.eventCompanies,
        matches: mockDemoBundle.accountMatches,
        score: mockDemoBundle.eventScore,
        memo: mockDemoBundle.decisionMemo,
        contacts: mockDemoBundle.contacts,
        outreachDrafts: mockDemoBundle.outreachDrafts,
        jobs: mockDemoBundle.jobs,
      },
      isLoading: false,
      hasResults: true,
    };
  }

  // Live mode. Convex Id<> brands are structurally compatible with our
  // SchruteId<> string brands, so we widen via `unknown` casts at the seam.
  const isLoading = liveEvent === undefined;

  if (!liveEvent) {
    return { bundle: null, isLoading, hasResults: false };
  }

  const matches = (liveMatches ?? []) as unknown as AccountMatch[];
  const score = (liveScore ?? null) as unknown as EventScore | null;
  const memo = (liveMemo ?? null) as unknown as DecisionMemo | null;

  const bundle: EventBundle = {
    event: liveEvent as unknown as Event,
    // Profile may still be loading; fall back to mock so the UI never breaks.
    revenueProfile:
      (liveProfile as unknown as RevenueProfile | null) ??
      mockDemoBundle.revenueProfile,
    crmAccounts: (liveAccounts ?? []) as unknown as CrmAccount[],
    eventCompanies: (liveCompanies ?? []) as unknown as EventCompany[],
    matches,
    score,
    memo,
    // Contacts + outreach live behind Nehal's sidecar; no contract query yet.
    // Fall back to mock so the drawer is populated in the demo. (TODO: add
    // convex/contracts.ts queries for contacts/outreachDrafts by event.)
    contacts: mockDemoBundle.contacts,
    outreachDrafts: mockDemoBundle.outreachDrafts,
    jobs: (liveJobs ?? []) as unknown as Job[],
  };

  return {
    bundle,
    isLoading,
    hasResults: matches.length > 0 && score !== null,
  };
}
