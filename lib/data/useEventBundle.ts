"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { DEMO_SCENARIOS, type LikelyAttendee } from "@/lib/data/demoBundle";
import { useDataMode } from "@/lib/data/DataModeContext";
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
  SourceDocument,
} from "@/lib/types";

/**
 * Data-adapter seam (Darren).
 *
 * The whole UI consumes this hook and never calls Convex directly, so we can
 * develop against rich demo data and flip to live Convex at runtime via the
 * Mock/Live toggle (DataModeContext). The initial mode is seeded from
 * NEXT_PUBLIC_USE_MOCKS ("false" => live).
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export const DEMO_EVENT_SLUG = "world-of-concrete-2026";

export type EventBundle = {
  event: Event;
  revenueProfile: RevenueProfile;
  crmAccounts: CrmAccount[];
  eventCompanies: EventCompany[];
  sourceDocuments: SourceDocument[];
  matches: AccountMatch[];
  score: EventScore | null;
  memo: DecisionMemo | null;
  contacts: Contact[];
  outreachDrafts: OutreachDraft[];
  jobs: Job[];
  attendees: LikelyAttendee[];
  /** True when contacts, drafts, or attendees are frontend demo fallbacks. */
  usesMockEnrichment: boolean;
};

export type UseEventBundleResult = {
  bundle: EventBundle | null;
  isLoading: boolean;
  hasResults: boolean;
};

export function useEventBundle(eventSlug?: string): UseEventBundleResult {
  const { mode, scenario } = useDataMode();
  const isMock = mode === "mock";
  const slug = eventSlug ?? DEMO_EVENT_SLUG;

  // Hooks must run unconditionally; in mock mode we pass "skip" so no network.
  const liveEvent = useQuery(
    api.events.getBySlug,
    isMock ? "skip" : { slug },
  );
  const eventId = liveEvent?._id;

  const liveMatches = useQuery(
    api.contracts.listAccountMatchesByEvent,
    !isMock && eventId ? { eventId } : "skip",
  );
  const liveScore = useQuery(
    api.contracts.getEventScore,
    !isMock && eventId ? { eventId } : "skip",
  );
  const liveMemo = useQuery(
    api.contracts.getDecisionMemo,
    !isMock && eventId ? { eventId } : "skip",
  );
  const liveJobs = useQuery(
    api.contracts.listJobsByEvent,
    !isMock && eventId ? { eventId } : "skip",
  );
  const liveCompanies = useQuery(
    api.ingest.listEventCompanies,
    !isMock && eventId ? { eventId } : "skip",
  );
  const liveSources = useQuery(
    api.ingest.listSourceDocuments,
    !isMock && eventId ? { eventId } : "skip",
  );
  const liveProfile = useQuery(
    api.profile.get,
    !isMock && liveEvent?.revenueProfileId
      ? { profileId: liveEvent.revenueProfileId }
      : "skip",
  );
  const liveAccounts = useQuery(
    api.profile.listAccounts,
    !isMock && liveEvent?.revenueProfileId
      ? { profileId: liveEvent.revenueProfileId }
      : "skip",
  );

  if (isMock) {
    const demo = DEMO_SCENARIOS[scenario].bundle;
    return {
      bundle: {
        event: demo.event,
        revenueProfile: demo.revenueProfile,
        crmAccounts: demo.crmAccounts,
        eventCompanies: demo.eventCompanies,
        sourceDocuments: demo.sourceDocuments,
        matches: demo.accountMatches,
        score: demo.eventScore,
        memo: demo.decisionMemo,
        contacts: demo.contacts,
        outreachDrafts: demo.outreachDrafts,
        jobs: demo.jobs,
        attendees: DEMO_SCENARIOS[scenario].attendees,
        usesMockEnrichment: false,
      },
      isLoading: false,
      hasResults: demo.accountMatches.length > 0,
    };
  }

  const isLoading = liveEvent === undefined;

  if (!liveEvent) {
    return { bundle: null, isLoading, hasResults: false };
  }

  const matches = (liveMatches ?? []) as unknown as AccountMatch[];
  const score = (liveScore ?? null) as unknown as EventScore | null;
  const memo = (liveMemo ?? null) as unknown as DecisionMemo | null;

  // Contacts + outreach live behind Nehal's sidecar; no contract query yet.
  const demoFallback = DEMO_SCENARIOS.attend.bundle;

  const bundle: EventBundle = {
    event: liveEvent as unknown as Event,
    revenueProfile:
      (liveProfile as unknown as RevenueProfile | null) ??
      demoFallback.revenueProfile,
    crmAccounts: (liveAccounts ?? []) as unknown as CrmAccount[],
    eventCompanies: (liveCompanies ?? []) as unknown as EventCompany[],
    sourceDocuments: (liveSources ?? []) as unknown as SourceDocument[],
    matches,
    score,
    memo,
    contacts: demoFallback.contacts,
    outreachDrafts: demoFallback.outreachDrafts,
    jobs: (liveJobs ?? []) as unknown as Job[],
    attendees: DEMO_SCENARIOS.attend.attendees,
    usesMockEnrichment: true,
  };

  return {
    bundle,
    isLoading,
    hasResults: matches.length > 0 && score !== null,
  };
}
