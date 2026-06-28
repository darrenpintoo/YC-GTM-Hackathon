"use client";

import * as React from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  Quote,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/schrute/atoms";
import type { LikelyAttendee } from "@/lib/data/demoBundle";
import { resolveMatchReason } from "@/lib/attendeeConnection";
import { cn } from "@/lib/utils";

const INLINE_MAX = 6;
const PREVIEW_COUNT = 6;

type MatchTag = { label: string; tone: string };

function matchTag(p: LikelyAttendee): MatchTag {
  if (p.matchTier === "tier1_crm")
    return {
      label: "In your pipeline",
      tone: "bg-tier1/12 text-tier1 border-tier1/25",
    };
  if (p.matchTier === "tier2_icp")
    return { label: "ICP fit", tone: "bg-icp/12 text-icp border-icp/25" };
  if (p.network === "web")
    return {
      label: "Speaker",
      tone: "bg-tier2/12 text-tier2 border-tier2/25",
    };
  if (p.network === "x")
    return { label: "From X post", tone: "bg-muted text-muted-foreground border-border" };
  return {
    label: "From LinkedIn",
    tone: "bg-muted text-muted-foreground border-border",
  };
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

function sortAttendees(attendees: LikelyAttendee[]): LikelyAttendee[] {
  return [...attendees].sort((a, b) => {
    const am = a.matchTier ? 0 : 1;
    const bm = b.matchTier ? 0 : 1;
    if (am !== bm) return am - bm;
    const ae = a.email ? 0 : 1;
    const be = b.email ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.fullName.localeCompare(b.fullName);
  });
}

export function AttendeeList({
  attendees,
  eventName = "this event",
  className,
  compact,
}: {
  attendees: LikelyAttendee[];
  eventName?: string;
  className?: string;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  if (attendees.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="size-5" />}
        title="No public attendance signals yet"
        description="No one in or near your pipeline has publicly posted about going to this event."
      />
    );
  }

  const sorted = sortAttendees(attendees);
  const showInline = compact || attendees.length <= INLINE_MAX;
  const needsExpand = !showInline && sorted.length > PREVIEW_COUNT;
  const visibleCount = showInline
    ? sorted.length
    : expanded
      ? sorted.length
      : Math.min(PREVIEW_COUNT, sorted.length);
  const visible = sorted.slice(0, visibleCount);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className={cn("min-w-0", className)}>
      {!compact ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
          <span>
            Sourced from <span className="font-medium text-foreground">public posts and event pages</span>,
            then enriched with verified contact details. We quote what they wrote and
            tie it to your accounts — we never guess who&apos;ll show up.
          </span>
        </p>
      ) : null}

      {needsExpand && !expanded ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing top {PREVIEW_COUNT} of {sorted.length} people by match priority.
        </p>
      ) : null}

      <div
        className={cn(
          "grid min-w-0 gap-3",
          compact ? "" : "sm:grid-cols-2",
          expanded && needsExpand && "max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain pr-1",
        )}
      >
        {visible.map((p) => (
          <AttendeeCard key={p.id} p={p} eventName={eventName} />
        ))}
      </div>

      {needsExpand && hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all ${sorted.length} people`}
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
          />
        </Button>
      ) : null}
    </div>
  );
}

function AttendeeCard({
  p,
  eventName,
}: {
  p: LikelyAttendee;
  eventName: string;
}) {
  const tag = matchTag(p);
  const role = p.enrichedTitle || p.title;
  const hasContact = Boolean(p.email || p.phone || p.location);
  const connection = resolveMatchReason(p.matchReason, {
    eventName,
    matchTier: p.matchTier,
    network: p.network,
    postQuote: p.postQuote,
    fullName: p.fullName,
    title: role,
    companyName: p.companyName,
  });

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
          {initials(p.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {p.profileUrl && p.profileUrl !== "#" ? (
              <a
                href={p.profileUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="group inline-flex min-w-0 items-center gap-1 hover:underline"
              >
                <span className="truncate text-sm font-semibold">{p.fullName}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ) : (
              <span className="truncate text-sm font-semibold">{p.fullName}</span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {role} · {p.companyName}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", tag.tone)}>
          {tag.label}
        </Badge>
      </div>

      {connection ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-success/20 bg-success/8 px-3 py-2 text-xs leading-relaxed text-foreground/90">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-success" />
          <span>{connection}</span>
        </p>
      ) : null}

      {p.postQuote ? (
        <blockquote className="relative rounded-lg bg-secondary/60 px-3 py-2 pl-7 text-xs leading-relaxed text-foreground/90">
          <Quote className="absolute left-2.5 top-2.5 size-3 text-muted-foreground" />
          <span className="line-clamp-4">{p.postQuote}</span>
        </blockquote>
      ) : null}

      {hasContact ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
          {p.email ? (
            <a
              href={`mailto:${p.email}`}
              className="inline-flex max-w-full items-center gap-1 truncate font-medium text-tier1 hover:underline"
            >
              <Mail className="size-3 shrink-0" />
              <span className="truncate">{p.email}</span>
              {p.emailStatus === "valid" ? (
                <BadgeCheck className="size-3 shrink-0 text-success" />
              ) : null}
            </a>
          ) : null}
          {p.phone ? (
            <a
              href={`tel:${p.phone}`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3" />
              {p.phone}
            </a>
          ) : null}
          {p.location ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" />
              {p.location}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">
          {p.network === "linkedin"
            ? "LinkedIn"
            : p.network === "x"
              ? "X / Twitter"
              : "Event page"}
        </span>
        {p.postedAt ? <span>{formatDate(p.postedAt)}</span> : null}
      </div>
    </div>
  );
}
