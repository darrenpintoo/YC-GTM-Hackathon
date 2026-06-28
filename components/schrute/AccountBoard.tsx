"use client";

import type { ReactNode } from "react";
import { Building2, RotateCcw } from "lucide-react";

import { EmptyState, TierBadge } from "@/components/schrute/atoms";
import { MatchListPanel } from "@/components/schrute/MatchListPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { TIER_META } from "@/lib/labels";
import type { AccountMatch, Contact } from "@/lib/types";

/** Show all inline when count is at or below this; otherwise preview + expand. */
const SECTION_INLINE_MAX = 6;
const SECTION_PREVIEW = 6;

type AccountBoardProps = {
  matches: AccountMatch[];
  contacts: Contact[];
  selectedId?: string | null;
  onSelect: (match: AccountMatch) => void;
  isLoading?: boolean;
};

export function AccountBoard({
  matches,
  contacts,
  selectedId,
  onSelect,
  isLoading,
}: AccountBoardProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        title="No matched accounts yet"
        description="Run the pipeline to surface which of your accounts are confirmed present at this event."
        icon={<Building2 className="size-5" />}
      />
    );
  }

  const confirmed = matches.filter((m) => m.presence !== "recurring");
  const recurring = matches.filter((m) => m.presence === "recurring");
  const tier1 = confirmed.filter((m) => m.tier === "tier1_crm");
  const tier2 = confirmed.filter((m) => m.tier === "tier2_icp");

  const listProps = {
    contacts,
    selectedId,
    onOpenAccount: onSelect,
    inlineMax: SECTION_INLINE_MAX,
    previewCount: SECTION_PREVIEW,
  };

  return (
    <div className="min-w-0 space-y-8">
      {tier1.length > 0 ? (
        <MatchSection
          badge={<TierBadge tier="tier1_crm" />}
          count={tier1.length}
          blurb={TIER_META.tier1_crm.blurb}
          matches={tier1}
          {...listProps}
        />
      ) : null}
      {tier2.length > 0 ? (
        <MatchSection
          badge={<TierBadge tier="tier2_icp" />}
          count={tier2.length}
          blurb={TIER_META.tier2_icp.blurb}
          matches={tier2}
          {...listProps}
        />
      ) : null}
      {recurring.length > 0 ? (
        <MatchSection
          badge={
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              <RotateCcw className="size-3" />
              Likely to return
            </span>
          }
          count={recurring.length}
          blurb="Named only at past editions — upside, not counted in break-even."
          matches={recurring}
          {...listProps}
        />
      ) : null}
    </div>
  );
}

function MatchSection({
  badge,
  count,
  blurb,
  matches,
  contacts,
  selectedId,
  onOpenAccount,
  inlineMax,
  previewCount,
}: {
  badge: ReactNode;
  count: number;
  blurb: string;
  matches: AccountMatch[];
  contacts: Contact[];
  selectedId?: string | null;
  onOpenAccount: (match: AccountMatch) => void;
  inlineMax: number;
  previewCount: number;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {badge}
          <span className="text-sm font-medium">
            {count} {count === 1 ? "account" : "accounts"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{blurb}</span>
      </div>
      <MatchListPanel
        matches={matches}
        contacts={contacts}
        selectedId={selectedId}
        onOpenAccount={onOpenAccount}
        inlineMax={inlineMax}
        previewCount={previewCount}
      />
    </section>
  );
}
