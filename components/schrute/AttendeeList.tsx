"use client";

import * as React from "react";
import { ArrowUpRight, BadgeCheck, Quote, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/schrute/atoms";
import type { LikelyAttendee } from "@/lib/data/demoBundle";
import { cn } from "@/lib/utils";

function intentLabel(confidence: number): { label: string; tone: string } {
  if (confidence >= 0.85)
    return { label: "High intent", tone: "bg-success/12 text-success border-success/25" };
  if (confidence >= 0.6)
    return { label: "Likely", tone: "bg-tier2/12 text-tier2 border-tier2/25" };
  return { label: "Possible", tone: "bg-muted text-muted-foreground border-border" };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AttendeeList({
  attendees,
  className,
  compact,
}: {
  attendees: LikelyAttendee[];
  className?: string;
  compact?: boolean;
}) {
  if (attendees.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="size-5" />}
        title="No public attendance signals yet"
        description="No one in or near your pipeline has publicly posted about going to this event."
      />
    );
  }

  const sorted = [...attendees].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className={className}>
      {!compact ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
          <span>
            Self-declared from <span className="font-medium text-foreground">public posts</span>.
            We quote what they wrote and tie it to your accounts — we never guess
            who&apos;ll show up.
          </span>
        </p>
      ) : null}

      <div className={cn("grid gap-3", compact ? "" : "sm:grid-cols-2")}>
        {sorted.map((p) => {
          const intent = intentLabel(p.confidence);
          return (
            <a
              key={p.id}
              href={p.profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                  {initials(p.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {p.fullName}
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.title} · {p.companyName}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[10px]", intent.tone)}
                >
                  {intent.label}
                </Badge>
              </div>

              <blockquote className="relative rounded-lg bg-secondary/60 px-3 py-2 pl-7 text-xs leading-relaxed text-foreground/90">
                <Quote className="absolute left-2.5 top-2.5 size-3 text-muted-foreground" />
                {p.postQuote}
              </blockquote>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium uppercase tracking-wide">
                  {p.network === "linkedin" ? "LinkedIn" : "X / Twitter"}
                </span>
                <span>
                  {formatDate(p.postedAt)} · {Math.round(p.confidence * 100)}%
                  confidence
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
