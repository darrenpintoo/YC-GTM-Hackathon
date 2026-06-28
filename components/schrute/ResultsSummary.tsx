"use client";

import { Building2, DollarSign, Flame, Target } from "lucide-react";

import { VerdictBadge } from "@/components/schrute/atoms";
import type { AccountMatch, DecisionMemo, EventScore } from "@/lib/types";
import { useCountUp } from "@/lib/useCountUp";
import { cn, formatCurrency } from "@/lib/utils";

type ResultsSummaryProps = {
  score: EventScore;
  matches: AccountMatch[];
  memo: DecisionMemo | null;
};

export function ResultsSummary({ score, matches, memo }: ResultsSummaryProps) {
  const openOpps = matches.filter((m) => m.matchedOppValue).length;
  const verdict = memo?.verdict ?? score.recommendation;

  const line =
    verdict === "skip"
      ? "Popular, not profitable. Your pipeline isn't on this floor — skip the booth."
      : `${matches.length} of your accounts are on this floor. ${openOpps} open ${
          openOpps === 1 ? "deal" : "deals"
        } worth ${formatCurrency(score.matchedPipelineValue, {
          compact: true,
        })}. Go book them.`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid-bg flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-2xl text-lg font-semibold leading-snug sm:text-xl">
            {line}
          </p>
          <VerdictBadge verdict={verdict} className="shrink-0 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigStat
            icon={<Building2 className="size-4" />}
            label="Accounts present"
            value={matches.length}
          />
          <BigStat
            icon={<Flame className="size-4" />}
            label="Open opps here"
            value={openOpps}
            accent="success"
          />
          <BigStat
            icon={<DollarSign className="size-4" />}
            label="Matched pipeline"
            value={score.matchedPipelineValue}
            currency
            accent="success"
          />
          <BigStat
            icon={<Target className="size-4" />}
            label="Meetings to break even"
            value={score.requiredQualifiedMeetings}
            accent="warning"
          />
        </div>
      </div>
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  currency,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  currency?: boolean;
  accent?: "success" | "warning";
}) {
  const animated = useCountUp(value);
  const display = currency
    ? formatCurrency(animated, { compact: true })
    : Math.round(animated).toString();

  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : "text-foreground";

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums sm:text-3xl", accentClass)}>
        {display}
      </div>
    </div>
  );
}
