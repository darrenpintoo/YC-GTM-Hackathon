"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

import { AccountMatchCard } from "@/components/schrute/AccountMatchCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountMatch, Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MatchListPanelProps = {
  matches: AccountMatch[];
  contacts?: Contact[];
  selectedId?: string | null;
  onOpenAccount?: (m: AccountMatch) => void;
  showValue?: boolean;
  /** Render every row when count is at or below this (default 6). */
  inlineMax?: number;
  /** Rows shown before expand (default 6). */
  previewCount?: number;
  showBoardLink?: boolean;
  emptyMessage?: string;
  compact?: boolean;
};

export function MatchListPanel({
  matches,
  contacts = [],
  selectedId,
  onOpenAccount,
  showValue,
  inlineMax = 6,
  previewCount = 6,
  showBoardLink = false,
  emptyMessage = "No matches in this group.",
  compact = false,
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
  const needsExpand = !showInline && filtered.length > previewCount;
  const visibleCount = showInline
    ? filtered.length
    : expanded
      ? filtered.length
      : Math.min(previewCount, filtered.length);
  const visible = filtered.slice(0, visibleCount);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="min-w-0 space-y-3">
      {matches.length > inlineMax ? (
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${matches.length} companies…`}
            className="h-8 pl-8 text-sm"
          />
        </div>
      ) : null}

      {needsExpand && !expanded ? (
        <p className="text-xs text-muted-foreground">
          Showing top {previewCount} of {filtered.length} matches by fit score.
        </p>
      ) : null}

      <div
        className={cn(
          "grid min-w-0 gap-3 sm:grid-cols-2",
          expanded && needsExpand && "max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain pr-1",
        )}
      >
        {visible.map((m, i) => (
          <AccountMatchCard
            key={m._id}
            match={m}
            index={i}
            contact={contactByMatch.get(m._id)}
            selected={selectedId === m._id}
            showValue={showValue}
            compact={compact}
            onSelect={onOpenAccount}
          />
        ))}
      </div>

      {filtered.length === 0 && query ? (
        <p className="text-sm text-muted-foreground">
          No companies match &ldquo;{query}&rdquo;.
        </p>
      ) : null}

      {needsExpand && hiddenCount > 0 ? (
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
