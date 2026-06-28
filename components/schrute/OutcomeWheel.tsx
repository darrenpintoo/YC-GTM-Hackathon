"use client";

import * as React from "react";
import {
  Building2,
  CalendarCheck,
  ChevronDown,
  DollarSign,
  FileText,
  Flame,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { AttendeeList } from "@/components/schrute/AttendeeList";
import { MatchListPanel } from "@/components/schrute/MatchListPanel";
import { VerdictBadge } from "@/components/schrute/atoms";
import type { LikelyAttendee } from "@/lib/data/demoBundle";
import type {
  AccountMatch,
  Contact,
  DecisionMemo,
  Event,
  EventScore,
  OutreachDraft,
} from "@/lib/types";
import { useCountUp } from "@/lib/useCountUp";
import { cn, formatCurrency } from "@/lib/utils";

type SignalKey =
  | "accounts"
  | "footprint"
  | "icp"
  | "opps"
  | "meetings"
  | "sponsor"
  | "drafts"
  | "people";

type OutcomeWheelProps = {
  event: Event;
  score: EventScore;
  matches: AccountMatch[];
  memo: DecisionMemo | null;
  attendees: LikelyAttendee[];
  contacts: Contact[];
  outreachDrafts: OutreachDraft[];
  onOpenAccount?: (m: AccountMatch) => void;
};

const RING_META: Record<
  "known" | "footprint" | "icp",
  { key: SignalKey; label: string; color: string; var: string }
> = {
  known: { key: "accounts", label: "Known accounts", color: "text-tier1", var: "var(--tier1)" },
  footprint: { key: "footprint", label: "Event footprint", color: "text-tier2", var: "var(--tier2)" },
  icp: { key: "icp", label: "ICP match", color: "text-icp", var: "var(--icp)" },
};

export function OutcomeWheel({
  event,
  score,
  matches,
  memo,
  attendees,
  contacts,
  outreachDrafts,
  onOpenAccount,
}: OutcomeWheelProps) {
  const [expanded, setExpanded] = React.useState<SignalKey | null>(null);

  const verdict = memo?.verdict ?? score.recommendation;
  // Confirmed this year vs likely-to-return (named only in a past edition).
  const confirmed = matches.filter((m) => m.presence !== "recurring");
  const recurring = matches.filter((m) => m.presence === "recurring");
  const recurringCrm = recurring.filter((m) => m.tier === "tier1_crm");
  const openOpps = confirmed.filter((m) => m.matchedOppValue);
  const tier1 = confirmed.filter((m) => m.tier === "tier1_crm");
  const tier2 = confirmed.filter((m) => m.tier === "tier2_icp");

  const sub = score.subScores ?? {};
  const known = clamp(sub.pipelinePresence ?? 0.6);
  const footprint = clamp(sub.evidenceQuality ?? 0.6);
  const icpDensity = clamp(sub.icpDensity ?? 0.5);

  const confidence =
    footprint >= 0.8 ? "High confidence" : footprint >= 0.55 ? "Moderate confidence" : "Low confidence";

  function toggle(key: SignalKey) {
    setExpanded((cur) => (cur === key ? null : key));
  }

  const stats: {
    key: SignalKey;
    icon: React.ReactNode;
    value: number;
    currency?: boolean;
    label: string;
    sub: string;
    color: string;
  }[] = [
    {
      key: "accounts",
      icon: <Building2 className="size-4" />,
      value: confirmed.length,
      label: "Accounts found",
      sub:
        recurring.length > 0
          ? `Confirmed this year · ${recurring.length} more likely to return`
          : `Your companies at ${event.name}`,
      color: "text-tier1",
    },
    {
      key: "opps",
      icon: <Flame className="size-4" />,
      value: openOpps.length,
      label: "Open opportunities",
      sub: `Worth ${formatCurrency(score.matchedPipelineValue, { compact: true })} in pipeline`,
      color: "text-icp",
    },
    {
      key: "people",
      icon: <Users className="size-4" />,
      value: attendees.length,
      label: "People posting about going",
      sub: "Self-declared from public posts",
      color: "text-tier2",
    },
    {
      key: "meetings",
      icon: <Target className="size-4" />,
      value: score.requiredQualifiedMeetings,
      label: "Meetings to break even",
      sub: "That's all it takes to cover cost",
      color: "text-foreground",
    },
    {
      key: "sponsor",
      icon: <DollarSign className="size-4" />,
      value: score.sponsorCap,
      currency: true,
      label: "Spend cap",
      sub: "Max worth committing to this floor",
      color: "text-foreground",
    },
    {
      key: "drafts",
      icon: <FileText className="size-4" />,
      value: outreachDrafts.length || contacts.length,
      label: "Drafts ready",
      sub: "Personalized meeting requests",
      color: "text-foreground",
    },
  ];

  const leftStats = stats.slice(0, 3);
  const rightStats = stats.slice(3);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-success">The outcome</p>
            <h2 className="mt-2 max-w-xl font-display text-3xl leading-[1.1] sm:text-4xl">
              {verdictHeadline(verdict, memo)}
            </h2>
          </div>
          <VerdictBadge verdict={verdict} className="text-sm" />
        </div>

        {recurring.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {confirmed.length} confirmed
            </span>{" "}
            at {event.name} this year ·{" "}
            <span className="font-medium text-warning">
              {recurring.length} likely to return
            </span>{" "}
            from past editions (upside, not counted in break-even).
          </p>
        ) : null}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(["known", "footprint", "icp"] as const).map((r) => {
            const meta = RING_META[r];
            const active = expanded === meta.key;
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle(meta.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-foreground/20 bg-secondary"
                    : "border-border bg-card hover:bg-secondary/60",
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: meta.var }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Wheel + flanking stats */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,auto)_1fr] lg:items-center">
          <div className="order-2 grid grid-cols-2 gap-3 lg:order-1 lg:grid-cols-1">
            {leftStats.map((s) => (
              <StatCallout
                key={s.key}
                icon={s.icon}
                value={s.value}
                currency={s.currency}
                label={s.label}
                sub={s.sub}
                color={s.color}
                active={expanded === s.key}
                onClick={() => toggle(s.key)}
                align="right"
              />
            ))}
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <Wheel
              known={known}
              footprint={footprint}
              icpDensity={icpDensity}
              centerValue={score.matchedPipelineValue}
              confidence={confidence}
              onNode={(key) => toggle(key)}
              activeKey={expanded}
            />
          </div>

          <div className="order-3 grid grid-cols-2 gap-3 lg:grid-cols-1">
            {rightStats.map((s) => (
              <StatCallout
                key={s.key}
                icon={s.icon}
                value={s.value}
                currency={s.currency}
                label={s.label}
                sub={s.sub}
                color={s.color}
                active={expanded === s.key}
                onClick={() => toggle(s.key)}
                align="left"
              />
            ))}
          </div>
        </div>

        {/* Expandable signals */}
        <SignalPanel
          expanded={expanded}
          onClose={() => setExpanded(null)}
          matches={matches}
          confirmed={confirmed}
          tier1={tier1}
          tier2={tier2}
          recurringCrm={recurringCrm}
          openOpps={openOpps}
          attendees={attendees}
          outreachDrafts={outreachDrafts}
          contacts={contacts}
          score={score}
          event={event}
          onOpenAccount={onOpenAccount}
        />

        {expanded === null ? (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Click any{" "}
            <span className="inline-flex size-3.5 translate-y-0.5 items-center justify-center rounded-full bg-foreground text-[8px] text-background">
              +
            </span>{" "}
            on the rings — or any number — to expand the signals we found.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}

function verdictHeadline(verdict: string, memo: DecisionMemo | null): React.ReactNode {
  if (memo?.headline) {
    const [lead, tail] = memo.headline.split("—");
    if (lead && tail) {
      return (
        <>
          {lead.trim()}{" "}
          <span className="italic text-muted-foreground">— {tail.trim()}</span>
        </>
      );
    }
    return memo.headline;
  }
  return verdict === "skip" ? "Skip — popular, not profitable." : "Attend — walk in with a worklist.";
}

// ---------------------------------------------------------------------------
// The radial wheel
// ---------------------------------------------------------------------------

function Wheel({
  known,
  footprint,
  icpDensity,
  centerValue,
  confidence,
  onNode,
  activeKey,
}: {
  known: number;
  footprint: number;
  icpDensity: number;
  centerValue: number;
  confidence: string;
  onNode: (key: SignalKey) => void;
  activeKey: SignalKey | null;
}) {
  const size = 260;
  const c = size / 2;
  const rings = [
    { key: "accounts" as SignalKey, r: 112, frac: known, color: "var(--tier1)" },
    { key: "footprint" as SignalKey, r: 92, frac: footprint, color: "var(--tier2)" },
    { key: "icp" as SignalKey, r: 72, frac: icpDensity, color: "var(--icp)" },
  ];
  const animated = useCountUp(centerValue);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring) => {
          const circ = 2 * Math.PI * ring.r;
          const dash = circ * ring.frac;
          const angle = (-90 + ring.frac * 360) * (Math.PI / 180);
          const nx = c + ring.r * Math.cos(angle);
          const ny = c + ring.r * Math.sin(angle);
          const isActive = activeKey === ring.key;
          return (
            <g key={ring.key}>
              <circle
                cx={c}
                cy={c}
                r={ring.r}
                fill="none"
                stroke="var(--border)"
                strokeWidth={10}
              />
              <circle
                cx={c}
                cy={c}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                transform={`rotate(-90 ${c} ${c})`}
                style={{
                  transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)",
                  opacity: activeKey && !isActive ? 0.35 : 1,
                }}
              />
              <g
                onClick={() => onNode(ring.key)}
                style={{ cursor: "pointer" }}
                className="transition-transform"
              >
                <circle
                  cx={nx}
                  cy={ny}
                  r={isActive ? 13 : 11}
                  fill={ring.color}
                  stroke="var(--card)"
                  strokeWidth={3}
                />
                <line x1={nx - 4} y1={ny} x2={nx + 4} y2={ny} stroke="white" strokeWidth={2} strokeLinecap="round" />
                <line x1={nx} y1={ny - 4} x2={nx} y2={ny + 4} stroke="white" strokeWidth={2} strokeLinecap="round" />
              </g>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">
          {formatCurrency(animated, { compact: true })}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">Pipeline present</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
          <CalendarCheck className="size-3" />
          {confidence}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat callouts
// ---------------------------------------------------------------------------

function StatCallout({
  icon,
  value,
  currency,
  label,
  sub,
  color,
  active,
  onClick,
  align,
}: {
  icon: React.ReactNode;
  value: number;
  currency?: boolean;
  label: string;
  sub: string;
  color: string;
  active: boolean;
  onClick: () => void;
  align: "left" | "right";
}) {
  const animated = useCountUp(value);
  const display = currency
    ? formatCurrency(animated, { compact: true })
    : Math.round(animated).toString();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border p-3 text-left transition-all",
        active
          ? "border-foreground/20 bg-secondary shadow-sm"
          : "border-transparent hover:border-border hover:bg-secondary/50",
        align === "right" ? "lg:text-right" : "lg:text-left",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
          align === "right" ? "lg:justify-end" : "",
        )}
      >
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 font-display text-3xl font-semibold tabular-nums", color)}>
        {display}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="truncate">{sub}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 transition-colors group-hover:text-foreground",
          align === "right" ? "lg:flex-row-reverse" : "",
        )}
      >
        {active ? "Hide signals" : "View"}
        <ChevronDown className={cn("size-3 transition-transform", active && "rotate-180")} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Expandable signal panel
// ---------------------------------------------------------------------------

function SignalPanel({
  expanded,
  matches,
  confirmed,
  tier1,
  tier2,
  recurringCrm,
  openOpps,
  attendees,
  outreachDrafts,
  contacts,
  score,
  event,
  onOpenAccount,
}: {
  expanded: SignalKey | null;
  onClose: () => void;
  matches: AccountMatch[];
  confirmed: AccountMatch[];
  tier1: AccountMatch[];
  tier2: AccountMatch[];
  recurringCrm: AccountMatch[];
  openOpps: AccountMatch[];
  attendees: LikelyAttendee[];
  outreachDrafts: OutreachDraft[];
  contacts: Contact[];
  score: EventScore;
  event: Event;
  onOpenAccount?: (m: AccountMatch) => void;
}) {
  if (!expanded) return null;

  const meta = PANEL_META[expanded];
  const listProps = {
    contacts,
    onOpenAccount,
  };

  return (
    <div className="mt-6 animate-in fade-in-50 slide-in-from-top-2 rounded-xl border border-border bg-secondary/40 p-4 duration-300 motion-reduce:animate-none sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {meta.icon}
        <h3 className="text-sm font-semibold">{meta.title}</h3>
      </div>

      {expanded === "people" ? (
        <AttendeeList attendees={attendees} />
      ) : expanded === "drafts" ? (
        <DraftSignals drafts={outreachDrafts} contacts={contacts} />
      ) : expanded === "meetings" ? (
        <EconomicsSignals score={score} openOppCount={openOpps.length} />
      ) : expanded === "sponsor" ? (
        <SponsorSignals score={score} event={event} />
      ) : expanded === "opps" ? (
        <MatchListPanel matches={openOpps} showValue {...listProps} />
      ) : expanded === "icp" ? (
        <MatchListPanel
          matches={tier2}
          showBoardLink
          {...listProps}
        />
      ) : expanded === "footprint" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {matches.length} total matches across the event — previewing confirmed
            accounts ({confirmed.length}).
          </p>
          <MatchListPanel
            matches={confirmed}
            showBoardLink
            {...listProps}
          />
        </div>
      ) : tier1.length > 0 ? (
        <MatchListPanel matches={tier1} {...listProps} />
      ) : recurringCrm.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            None of your CRM accounts are confirmed on this year&apos;s floor yet — but
            these attended past editions and are likely to return:
          </p>
          <MatchListPanel matches={recurringCrm} {...listProps} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No CRM accounts matched yet. As more sources are gathered, confirmed and
          likely-to-return accounts will appear here.
        </p>
      )}
    </div>
  );
}

const PANEL_META: Record<SignalKey, { title: string; icon: React.ReactNode }> = {
  accounts: { title: "Your accounts confirmed on the floor", icon: <Building2 className="size-4 text-tier1" /> },
  footprint: { title: "Full event footprint we matched", icon: <Target className="size-4 text-tier2" /> },
  icp: { title: "Net-new ICP companies (not in your CRM)", icon: <Sparkles className="size-4 text-icp" /> },
  opps: { title: "Open opportunities walking the floor", icon: <Flame className="size-4 text-icp" /> },
  meetings: { title: "Break-even math", icon: <Target className="size-4 text-foreground" /> },
  sponsor: { title: "Spend cap breakdown", icon: <DollarSign className="size-4 text-foreground" /> },
  drafts: { title: "Outreach drafts ready to send", icon: <FileText className="size-4 text-foreground" /> },
  people: { title: "People posting about going", icon: <Users className="size-4 text-tier2" /> },
};

function DraftSignals({
  drafts,
  contacts,
}: {
  drafts: OutreachDraft[];
  contacts: Contact[];
}) {
  if (drafts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {contacts.length} contacts enriched — open an account to draft outreach.
      </p>
    );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {drafts.map((d) => (
        <div key={d._id} className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-semibold">{d.subject}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {d.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function EconomicsSignals({
  score,
  openOppCount,
}: {
  score: EventScore;
  openOppCount: number;
}) {
  const rows = [
    { label: "All-in event cost", value: formatCurrency(score.totalEventCost) },
    {
      label: "Revenue per qualified meeting",
      value: formatCurrency(score.revenuePerQualifiedMeeting),
    },
    { label: "Qualified meetings to break even", value: String(score.requiredQualifiedMeetings) },
    { label: "Open opps already on the floor", value: String(openOppCount) },
  ];
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        You need {score.requiredQualifiedMeetings} qualified meetings to break even — and you
        already have {openOppCount} open {openOppCount === 1 ? "opp" : "opps"} confirmed present.
      </p>
    </div>
  );
}

function SponsorSignals({ score, event }: { score: EventScore; event: Event }) {
  const quote = event.sponsorQuote;
  const over = quote ? quote > score.sponsorCap : false;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Spend cap (max worth it)
          </div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatCurrency(score.sponsorCap)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Their booth quote
          </div>
          <div
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums",
              over ? "text-destructive" : "text-success",
            )}
          >
            {quote ? formatCurrency(quote) : "—"}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {over
          ? `The ${formatCurrency(quote!)} booth is over your ${formatCurrency(
              score.sponsorCap,
            )} cap. Your accounts are here whether you exhibit or not — attend, don't exhibit.`
          : "The quote sits inside your cap — exhibiting is defensible if you want the floor presence."}
      </p>
    </div>
  );
}
