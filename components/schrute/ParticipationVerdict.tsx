"use client";

import * as React from "react";
import {
  CircleHelp,
  Megaphone,
  Mic,
  Store,
  UserCheck,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  evaluateParticipation,
  OBJECTIVES,
  PARTICIPATION,
  type ObjectiveKey,
  type ParticipationKey,
  type ParticipationStatus,
} from "@/lib/objectives";
import type { AccountMatch, Event, EventScore } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ParticipationKey, React.ReactNode> = {
  attend: <Users className="size-4" />,
  sponsor: <Megaphone className="size-4" />,
  speak: <Mic className="size-4" />,
  exhibit: <Store className="size-4" />,
};

const STATUS_META: Record<
  ParticipationStatus,
  { icon: React.ReactNode; ring: string; chip: string }
> = {
  yes: {
    icon: <CheckCircle2 className="size-4 text-success" />,
    ring: "border-success/30",
    chip: "bg-success/12 text-success",
  },
  maybe: {
    icon: <CircleHelp className="size-4 text-warning" />,
    ring: "border-warning/30",
    chip: "bg-warning/12 text-warning",
  },
  no: {
    icon: <XCircle className="size-4 text-destructive" />,
    ring: "border-destructive/30",
    chip: "bg-destructive/12 text-destructive",
  },
};

export function ParticipationVerdict({
  objective,
  options,
  score,
  event,
  matches,
  repCount,
}: {
  objective: ObjectiveKey | null;
  options: ParticipationKey[];
  score: EventScore;
  event: Event;
  matches: AccountMatch[];
  repCount?: number;
}) {
  const ctx = {
    sponsorQuote: event.sponsorQuote,
    sponsorCap: score.sponsorCap,
    accountsPresent: matches.length,
    openOppCount: matches.filter((m) => m.matchedOppValue).length,
    icpDensity: score.subScores?.icpDensity ?? 0.5,
    repCount,
  };

  const objectiveDef = OBJECTIVES.find((o) => o.key === objective);
  const selected = new Set(options);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <UserCheck className="size-4 text-success" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Is it worth it?
        </h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {objectiveDef
          ? `Tuned to your goal: ${objectiveDef.title.toLowerCase()}.`
          : "How each way of showing up pencils out for this event."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PARTICIPATION.map((p) => {
          const result = evaluateParticipation(p.key, ctx);
          const meta = STATUS_META[result.status];
          const isSelected = selected.has(p.key);
          return (
            <div
              key={p.key}
              className={cn(
                "rounded-xl border bg-background/40 p-3.5 transition-colors",
                isSelected ? meta.ring : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{ICONS[p.key]}</span>
                  <span className="text-sm font-semibold">{p.title}</span>
                </div>
                {meta.icon}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    meta.chip,
                  )}
                >
                  {result.headline}
                </span>
                {isSelected ? (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    You&apos;re weighing this
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {result.reason}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
