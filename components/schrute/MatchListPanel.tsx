"use client";

import * as React from "react";
import { BadgeCheck, ChevronDown, Search } from "lucide-react";

import {
  EvidenceChip,
  PresenceBadge,
  TierBadge,
} from "@/components/schrute/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/labels";
import type { AccountMatch, Contact } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

export type MatchListPanelProps = {
  matches: AccountMatch[];
  contacts?: Contact[];
  onOpenAccount?: (m: AccountMatch) => void;
  showValue?: boolean;
  /** Render every row when count is at or below this (default 15). */
  inlineMax?: number;
  /** Rows shown before expand (default 8). */
  previewCount?: number;
  showBoardLink?: boolean;
  emptyMessage?: string;
};

export function MatchListPanel({
  matches,
  contacts = [],
  onOpenAccount,
  showValue,
  inlineMax = 15,
  previewCount = 8,
  showBoardLink = false,
  emptyMessage = "No matches in this group.",
}: MatchListPanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const contactByMatch = React.useMemo(
    () => new Map(contacts.map((c) => [c.accountMatchId, c])),
    [contacts],
  );

  const sorted = React.useMemo(
    () =>
      [...matches].sort((a, b) => {
        const ar = a.rank ?? 999;
        const br = b.rank ?? 999;
        if (ar !== br) return ar - br;
        return b.fitScore - a.fitScore;
      }),
    [matches],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((m) => m.companyName.toLowerCase().includes(q));
  }, [sorted, query]);

  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const showInline = matches.length <= inlineMax;
  const visibleCount = showInline
    ? filtered.length
    : expanded
      ? filtered.length
      : Math.min(previewCount, filtered.length);
  const visible = filtered.slice(0, visibleCount);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="space-y-3">
      {matches.length > inlineMax ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${matches.length} companies…`}
            className="h-8 pl-8 text-sm"
          />
        </div>
      ) : null}

      {!showInline && !expanded && filtered.length > previewCount ? (
        <p className="text-xs text-muted-foreground">
          Showing top {previewCount} of {filtered.length} matches by fit score.
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-2 sm:grid-cols-2",
          expanded && !showInline && "max-h-72 overflow-y-auto pr-1",
        )}
      >
        {visible.map((m, i) => (
          <MatchRow
            key={m._id}
            match={m}
            index={i}
            contact={contactByMatch.get(m._id)}
            showValue={showValue}
            onOpenAccount={onOpenAccount}
          />
        ))}
      </div>

      {filtered.length === 0 && query ? (
        <p className="text-sm text-muted-foreground">No companies match &ldquo;{query}&rdquo;.</p>
      ) : null}

      {!showInline && hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all ${filtered.length} matches`}
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
          />
        </Button>
      ) : null}

      {showBoardLink && matches.length > inlineMax ? (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() =>
            document.getElementById("accounts-board")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
        >
          Browse full list in Accounts board ↓
        </button>
      ) : null}
    </div>
  );
}

function MatchRow({
  match,
  index,
  contact,
  showValue,
  onOpenAccount,
}: {
  match: AccountMatch;
  index: number;
  contact?: Contact;
  showValue?: boolean;
  onOpenAccount?: (m: AccountMatch) => void;
}) {
  return (
    <div
      role={onOpenAccount ? "button" : undefined}
      tabIndex={onOpenAccount ? 0 : undefined}
      onClick={onOpenAccount ? () => onOpenAccount(match) : undefined}
      onKeyDown={
        onOpenAccount
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenAccount(match);
              }
            }
          : undefined
      }
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className={cn(
        "rounded-lg border border-border bg-card p-3 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-300 motion-reduce:animate-none",
        onOpenAccount && "cursor-pointer transition-colors hover:border-foreground/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{match.companyName}</span>
        <div className="flex shrink-0 items-center gap-1">
          <PresenceBadge
            presence={match.presence}
            editionLabel={match.editionLabel}
            className="text-[10px]"
          />
          <TierBadge tier={match.tier} className="text-[10px]" />
        </div>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {ROLE_LABEL[match.role] ?? match.role}
        {match.boothOrSession ? ` · ${match.boothOrSession}` : ""}
        {showValue && match.matchedOppValue
          ? ` · ${formatCurrency(match.matchedOppValue, { compact: true })}`
          : ""}
      </p>
      {match.contactName ? (
        <p className="mt-1 text-xs text-foreground/80">
          {match.contactTitle ? `${match.contactTitle}: ` : ""}
          <span className="font-medium">{match.contactName}</span>
        </p>
      ) : null}
      {match.evidence?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {match.evidence.map((e, i) => (
            <EvidenceChip key={i} evidence={e} />
          ))}
        </div>
      ) : null}
      {contact ? (
        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-tier1/15 px-2 py-0.5 text-[10px] font-medium text-tier1">
          <BadgeCheck className="size-3" />
          contact ready
        </span>
      ) : null}
    </div>
  );
}
