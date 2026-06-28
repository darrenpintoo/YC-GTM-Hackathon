"use client";

import { BadgeCheck, Building2, ChevronRight, MapPin, RotateCcw } from "lucide-react";

import {
  EmptyState,
  EvidenceChip,
  PresenceBadge,
  TierBadge,
} from "@/components/schrute/atoms";
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

  // Confirmed this year vs likely-to-return (named only in a past edition).
  const confirmed = matches.filter((m) => m.presence !== "recurring");
  const recurring = matches.filter((m) => m.presence === "recurring");
  const tier1 = confirmed.filter((m) => m.tier === "tier1_crm");
  const tier2 = confirmed.filter((m) => m.tier === "tier2_icp");

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
      {recurring.length > 0 ? (
        <RecurringGroup
          count={recurring.length}
          matches={recurring}
          contactByMatch={contactByMatch}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

function RecurringGroup({
  count,
  matches,
  contactByMatch,
  selectedId,
  onSelect,
}: {
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
          <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            <RotateCcw className="size-3" />
            Likely to return
          </span>
          <span className="text-sm font-medium">
            {count} {count === 1 ? "account" : "accounts"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Named only at past editions — upside, not counted in break-even.
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match, i) => (
          <AccountCard
            key={match._id}
            match={match}
            index={i}
            contact={contactByMatch.get(match._id)}
            selected={selectedId === match._id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
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
        {matches.map((match, i) => (
          <AccountCard
            key={match._id}
            match={match}
            index={i}
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
  index,
  contact,
  selected,
  onSelect,
}: {
  match: AccountMatch;
  index: number;
  contact?: Contact;
  selected: boolean;
  onSelect: (match: AccountMatch) => void;
}) {
  return (
    // Not a <button>: it contains interactive evidence chips (also buttons),
    // and nested buttons are invalid HTML. Use a clickable div with a11y.
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(match)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(match);
        }
      }}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      className={cn(
        "group flex w-full animate-in cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-left fade-in slide-in-from-bottom-2 outline-none transition-all duration-500 fill-mode-backwards hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/60",
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
          {match.presence === "recurring" ? (
            <div className="mt-2">
              <PresenceBadge
                presence={match.presence}
                editionLabel={match.editionLabel}
              />
            </div>
          ) : null}
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
    </div>
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
