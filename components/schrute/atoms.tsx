"use client";

import * as React from "react";
import {
  AlertTriangle,
  ExternalLink,
  FileWarning,
  Inbox,
  Quote,
} from "lucide-react";

import { useEvidenceInspector } from "@/components/schrute/EvidenceInspector";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RECOMMENDATION_META, TIER_META } from "@/lib/labels";
import type { Evidence, MatchTier, Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  info: "bg-tier2/15 text-tier2 border-tier2/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: Recommendation;
  className?: string;
}) {
  const meta = RECOMMENDATION_META[verdict];
  return (
    <Badge
      variant="outline"
      className={cn("uppercase tracking-wide", TONE_CLASS[meta.tone], className)}
    >
      {meta.label}
    </Badge>
  );
}

export function TierBadge({
  tier,
  className,
}: {
  tier: MatchTier;
  className?: string;
}) {
  const isTier1 = tier === "tier1_crm";
  return (
    <Badge
      variant="outline"
      className={cn(
        isTier1
          ? "bg-tier1/15 text-tier1 border-tier1/30"
          : "bg-tier2/15 text-tier2 border-tier2/30",
        className,
      )}
    >
      {TIER_META[tier].short}
    </Badge>
  );
}

export function StatPill({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "success" | "warning" | "danger" | "default";
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : accent === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", accentClass)}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function EvidenceChip({ evidence }: { evidence: Evidence }) {
  const inspector = useEvidenceInspector();

  const chipClass =
    "inline-flex items-center gap-1 rounded-md border border-border bg-background/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground";

  const inner = (
    <>
      <Quote className="size-3" />
      <span className="capitalize">{evidence.factType}</span>
      {inspector ? null : <ExternalLink className="size-2.5 opacity-60" />}
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {inspector ? (
          <button
            type="button"
            onClick={(e) => {
              // Don't let the click bubble to a clickable parent (e.g. account card).
              e.stopPropagation();
              inspector.inspect(evidence);
            }}
            className={chipClass}
          >
            {inner}
          </button>
        ) : (
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className={chipClass}
          >
            {inner}
          </a>
        )}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">&ldquo;{evidence.quote}&rdquo;</p>
        <p className="mt-1 text-muted-foreground">
          {inspector ? "Click to inspect source" : "Open source"} · confidence{" "}
          {Math.round(evidence.confidence * 100)}%
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function FailedState({
  title = "Something broke",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-medium text-destructive">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MissingEvidenceNote({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
      <FileWarning className="mt-0.5 size-3.5 shrink-0" />
      <div>
        <span className="font-semibold">Missing evidence: </span>
        {items.join(" · ")}
      </div>
    </div>
  );
}
