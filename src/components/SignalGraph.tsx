"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  ChevronDown,
  ExternalLink,
  Layers,
  Sparkles,
  Target,
} from "lucide-react";
import type { EventSignal, SignalType } from "@/lib/types";
import { SIGNAL_META } from "@/lib/score";
import { cn } from "@/lib/cn";
import { Badge, SectionLabel } from "./ui/primitives";
import { useCountUp } from "./ui/useCountUp";

const TYPE_COLOR: Record<SignalType, string> = {
  attendee: "#34d399",
  "company-presence": "#60a5fa",
  historical: "#a78bfa",
  social: "#fbbf24",
  "icp-proxy": "#22d3ee",
};

const TYPE_ORDER: SignalType[] = [
  "attendee",
  "company-presence",
  "icp-proxy",
  "social",
  "historical",
];

function MatchBar({ value }: { value: number }) {
  const color = value >= 0.75 ? "var(--go)" : value >= 0.5 ? "var(--caution)" : "var(--skip)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function SignalRow({ s, index }: { s: EventSignal; index: number }) {
  const color = TYPE_COLOR[s.type];
  const named = s.company && s.company !== "—";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.3) }}
      className="group flex items-center gap-4 rounded-xl border border-border bg-white/[0.015] px-4 py-3 hover:border-border-strong hover:bg-white/[0.03]"
    >
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-sm font-semibold"
        style={{
          color,
          borderColor: `${color}44`,
          background: `${color}14`,
        }}
      >
        {named ? (
          s.company!.slice(0, 2).toUpperCase()
        ) : (
          <Layers className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-fg">
            {named ? s.company : s.descriptor}
          </span>
          {named && s.descriptor && (
            <span className="truncate text-xs text-faint">· {s.descriptor}</span>
          )}
          {s.lookalikeOf && (
            <Badge tone="signal" className="!py-0.5">
              <Sparkles className="h-3 w-3" />
              looks like {s.lookalikeOf}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">{s.evidence}</div>
      </div>

      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium"
          style={{ color, background: `${color}14` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {s.role}
        </span>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
        <MatchBar value={s.matchToICP} />
        <a
          href={s.source}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 font-mono text-[10px] text-faint hover:text-signal"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          {s.sourceLabel ?? "source"}
        </a>
      </div>
    </motion.div>
  );
}

export function SignalGraph({
  signals,
  closedWonCount,
}: {
  signals: EventSignal[];
  closedWonCount: number;
}) {
  const [filter, setFilter] = useState<SignalType | "all">("all");
  const [expanded, setExpanded] = useState(false);

  const companies = useMemo(
    () => signals.filter((s) => s.company && s.company !== "—"),
    [signals],
  );
  const matched = useMemo(() => signals.filter((s) => s.lookalikeOf), [signals]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of signals) m[s.type] = (m[s.type] ?? 0) + 1;
    return m;
  }, [signals]);

  const sorted = useMemo(
    () => [...signals].sort((a, b) => b.matchToICP - a.matchToICP),
    [signals],
  );
  const filtered = useMemo(
    () => (filter === "all" ? sorted : sorted.filter((s) => s.type === filter)),
    [sorted, filter],
  );

  const companiesFound = useCountUp(companies.length, 900);
  const COLLAPSED = 5;
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED);

  return (
    <div>
      {/* headline numbers */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> Event Signal Graph
          </SectionLabel>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-4xl font-semibold tabular-nums text-fg">
              {Math.round(companiesFound)}
            </span>
            <span className="text-sm text-muted">companies surfaced from public evidence</span>
          </div>
        </div>
        <div className="rounded-xl border border-[rgba(52,211,153,0.28)] bg-[var(--signal-dim)] px-4 py-2.5">
          <div className="flex items-center gap-2 text-signal">
            <Target className="h-4 w-4" />
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {matched.length}
            </span>
            <span className="text-sm">match your closed-won set</span>
          </div>
          <div className="mt-0.5 text-[11px] text-faint">
            out of {closedWonCount} lookalike accounts you win
          </div>
        </div>
      </div>

      {/* type filter chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All signals"
          count={signals.length}
          color="var(--fg)"
        />
        {TYPE_ORDER.filter((t) => counts[t]).map((t) => (
          <FilterChip
            key={t}
            active={filter === t}
            onClick={() => setFilter(t)}
            label={SIGNAL_META[t].short}
            count={counts[t]}
            color={TYPE_COLOR[t]}
          />
        ))}
      </div>

      {/* rows */}
      <div className="mt-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {visible.map((s, i) => (
            <SignalRow key={s.id} s={s} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {filtered.length > COLLAPSED && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white/[0.02] py-2.5 text-sm font-medium text-muted hover:border-border-strong hover:text-fg"
        >
          {expanded ? "Show less" : `Show all ${filtered.length} signals`}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-border-strong bg-white/[0.06] text-fg"
          : "border-border bg-transparent text-muted hover:text-fg",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
      <span className="font-mono tabular-nums text-faint">{count}</span>
    </button>
  );
}
