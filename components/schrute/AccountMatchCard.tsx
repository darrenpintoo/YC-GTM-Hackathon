"use client";

import { BadgeCheck, ChevronRight, MapPin } from "lucide-react";

import { EvidenceChip, PresenceBadge } from "@/components/schrute/atoms";
import { ROLE_LABEL } from "@/lib/labels";
import type { AccountMatch, Contact } from "@/lib/types";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

export type AccountMatchCardProps = {
  match: AccountMatch;
  index?: number;
  contact?: Contact;
  selected?: boolean;
  showValue?: boolean;
  compact?: boolean;
  onSelect?: (match: AccountMatch) => void;
};

/** Shared account card — used in AccountBoard, OutcomeWheel panels, and match lists. */
export function AccountMatchCard({
  match,
  index = 0,
  contact,
  selected = false,
  showValue = false,
  compact = false,
  onSelect,
}: AccountMatchCardProps) {
  const interactive = Boolean(onSelect);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onSelect!(match) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect!(match);
              }
            }
          : undefined
      }
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      className={cn(
        "group flex w-full min-w-0 animate-in flex-col gap-3 rounded-xl border bg-card text-left fade-in slide-in-from-bottom-2 outline-none transition-all duration-300 fill-mode-backwards motion-reduce:animate-none",
        compact ? "gap-2 p-3" : "p-4",
        interactive &&
          "cursor-pointer hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/60",
        selected ? "border-primary ring-1 ring-primary/40" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {match.rank ? (
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                #{match.rank}
              </span>
            ) : null}
            <h3 className="truncate font-semibold leading-tight">
              {match.companyName}
            </h3>
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {ROLE_LABEL[match.role] ?? match.role}
              {match.boothOrSession ? ` · ${match.boothOrSession}` : ""}
              {showValue && match.matchedOppValue
                ? ` · ${formatCurrency(match.matchedOppValue, { compact: true })}`
                : ""}
            </span>
          </p>
          {match.contactName ? (
            <p className="mt-1 truncate text-xs text-foreground/80">
              {match.contactTitle ? `${match.contactTitle}: ` : ""}
              <span className="font-medium">{match.contactName}</span>
            </p>
          ) : null}
          {match.presence === "recurring" ? (
            <div className="mt-2">
              <PresenceBadge
                presence={match.presence}
                editionLabel={match.editionLabel}
              />
            </div>
          ) : null}
        </div>
        {interactive ? (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        ) : null}
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <ScorePill label="fit" value={match.fitScore} />
          <ScorePill label="conf" value={match.confidence} />
          {match.matchedOppValue && !showValue ? (
            <span className="ml-auto rounded-md bg-success/15 px-2 py-0.5 font-semibold text-success">
              {formatCurrency(match.matchedOppValue, { compact: true })} open
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {match.evidence.slice(0, compact ? 1 : 2).map((ev, i) => (
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
