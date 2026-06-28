"use client";

import { BadgeCheck, Building2, ChevronRight, MapPin } from "lucide-react";

import { EmptyState, EvidenceChip, TierBadge } from "@/components/schrute/atoms";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABEL, TIER_META } from "@/lib/labels";
import type { AccountMatch, Contact } from "@/lib/types";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

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

  const tier1 = matches.filter((m) => m.tier === "tier1_crm");
  const tier2 = matches.filter((m) => m.tier === "tier2_icp");

  const contactByMatch = new Map(contacts.map((c) => [c.accountMatchId, c]));

  return (
    <div className="space-y-8">
      {tier1.length > 0 ? (
        <TierGroup
          tier="tier1_crm"
          count={tier1.length}
          matches={tier1}
          contactByMatch={contactByMatch}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
      {tier2.length > 0 ? (
        <TierGroup
          tier="tier2_icp"
          count={tier2.length}
          matches={tier2}
          contactByMatch={contactByMatch}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

function TierGroup({
  tier,
  count,
  matches,
  contactByMatch,
  selectedId,
  onSelect,
}: {
  tier: AccountMatch["tier"];
  count: number;
  matches: AccountMatch[];
  contactByMatch: Map<string, Contact>;
  selectedId?: string | null;
  onSelect: (match: AccountMatch) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <TierBadge tier={tier} />
          <span className="text-sm font-medium">
            {count} {count === 1 ? "account" : "accounts"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {TIER_META[tier].blurb}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match) => (
          <AccountCard
            key={match._id}
            match={match}
            contact={contactByMatch.get(match._id)}
            selected={selectedId === match._id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function AccountCard({
  match,
  contact,
  selected,
  onSelect,
}: {
  match: AccountMatch;
  contact?: Contact;
  selected: boolean;
  onSelect: (match: AccountMatch) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md",
        selected ? "border-primary ring-1 ring-primary/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {match.rank ? (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                #{match.rank}
              </span>
            ) : null}
            <h3 className="truncate font-semibold leading-tight">
              {match.companyName}
            </h3>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {ROLE_LABEL[match.role]}
            {match.boothOrSession ? ` · ${match.boothOrSession}` : ""}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ScorePill label="fit" value={match.fitScore} />
        <ScorePill label="conf" value={match.confidence} />
        {match.matchedOppValue ? (
          <span className="ml-auto rounded-md bg-success/15 px-2 py-0.5 font-semibold text-success">
            {formatCurrency(match.matchedOppValue, { compact: true })} open
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {match.evidence.slice(0, 2).map((ev, i) => (
          <EvidenceChip key={i} evidence={ev} />
        ))}
        {contact ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-tier1/15 px-2 py-0.5 text-[11px] font-medium text-tier1">
            <BadgeCheck className="size-3" />
            contact ready
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{formatPercent(value)}</span>
    </span>
  );
}
