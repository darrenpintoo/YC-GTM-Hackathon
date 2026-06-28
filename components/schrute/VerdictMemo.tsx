"use client";

import { Calculator, Gauge, ScrollText } from "lucide-react";

import {
  EvidenceChip,
  MissingEvidenceNote,
  StatPill,
  VerdictBadge,
} from "@/components/schrute/atoms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { DecisionMemo, EventScore } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type VerdictMemoProps = {
  score: EventScore | null;
  memo: DecisionMemo | null;
  isLoading?: boolean;
};

const SUBSCORE_LABELS: Record<string, string> = {
  pipelinePresence: "Pipeline presence",
  evidenceQuality: "Evidence quality",
  costEfficiency: "Cost efficiency",
  icpDensity: "ICP density",
};

export function VerdictMemo({ score, memo, isLoading }: VerdictMemoProps) {
  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  if (!score && !memo) {
    return null;
  }

  const verdict = memo?.verdict ?? score?.recommendation;

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4 text-primary" />
            Go / No-Go memo
          </CardTitle>
          {verdict ? <VerdictBadge verdict={verdict} /> : null}
        </div>
        {memo ? (
          <p className="text-lg font-semibold leading-snug text-foreground">
            {memo.headline}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {score ? <Economics score={score} /> : null}

        {score ? (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Gauge className="size-4 text-muted-foreground" />
              Sub-scores
            </h4>
            <div className="space-y-2">
              {Object.entries(score.subScores).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-muted-foreground">
                    {SUBSCORE_LABELS[key] ?? key}
                  </span>
                  <Progress value={value * 100} className="h-1.5" />
                  <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">
                    {Math.round(value * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {memo && memo.sections.length > 0 ? (
          <div className="space-y-3">
            {memo.sections.map((section, i) => (
              <div key={i}>
                <h5 className="text-sm font-semibold">{section.title}</h5>
                <p className="mt-1 text-sm text-muted-foreground">
                  {section.body}
                </p>
                {section.citations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {section.citations.map((c, ci) => (
                      <EvidenceChip key={ci} evidence={c} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {score && score.rationale.length > 0 ? (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Why</h4>
            <ul className="space-y-1.5">
              {score.rationale.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {memo ? <MissingEvidenceNote items={memo.missingEvidence} /> : null}
      </CardContent>
    </Card>
  );
}

function Economics({ score }: { score: EventScore }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Calculator className="size-4 text-muted-foreground" />
        Break-even math
      </h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill
          label="Matched pipeline"
          value={formatCurrency(score.matchedPipelineValue, { compact: true })}
          hint={`${score.tier1MatchCount} Tier-1 · ${score.tier2MatchCount} Tier-2`}
          accent="success"
        />
        <StatPill
          label="All-in cost"
          value={formatCurrency(score.totalEventCost, { compact: true })}
          hint="sponsor + travel + rep time"
        />
        <StatPill
          label="Meetings to break even"
          value={score.requiredQualifiedMeetings}
          hint={`${formatCurrency(score.revenuePerQualifiedMeeting, {
            compact: true,
          })}/meeting`}
          accent="warning"
        />
        <StatPill
          label="Sponsor cap"
          value={formatCurrency(score.sponsorCap, { compact: true })}
          hint="max worth paying"
        />
      </div>
    </div>
  );
}
