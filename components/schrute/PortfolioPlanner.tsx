"use client";

import { MapPin, Plane, Sparkles } from "lucide-react";

import { VerdictBadge } from "@/components/schrute/atoms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PORTFOLIO_EVENTS, type PortfolioEvent } from "@/lib/data/demoBundle";
import { cn, formatCurrency } from "@/lib/utils";

export function PortfolioPlanner() {
  const events = [...PORTFOLIO_EVENTS].sort(
    (a, b) => b.matchedPipeline - a.matchedPipeline,
  );
  const totalPipeline = events.reduce((s, e) => s + e.matchedPipeline, 0);
  const maxPipeline = Math.max(...events.map((e) => e.matchedPipeline));

  // Pipeline concentration by region.
  const byRegion = new Map<string, { pipeline: number; count: number }>();
  for (const e of events) {
    const cur = byRegion.get(e.region) ?? { pipeline: 0, count: 0 };
    cur.pipeline += e.matchedPipeline;
    cur.count += 1;
    byRegion.set(e.region, cur);
  }
  const topRegion = [...byRegion.entries()].sort(
    (a, b) => b[1].pipeline - a[1].pipeline,
  )[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              Portfolio Planner
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary">
              V2 preview
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Not &ldquo;save on flights.&rdquo; The point is{" "}
            <span className="text-foreground">pipeline concentration</span> —
            send your best reps where your present pipeline actually clusters,
            and skip the rest.
          </p>
        </div>
      </div>

      {topRegion ? (
        <Card className="gap-3 border-primary/30">
          <CardContent className="flex items-start gap-3 pt-0">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {formatCurrency(topRegion[1].pipeline, { compact: true })} of
                your present pipeline clusters in {topRegion[0]} across{" "}
                {topRegion[1].count} shows.
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Send your two best reps there back-to-back. Travel efficiency is
                the side effect; focusing reps where pipeline is, is the point.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tracked events" value={String(events.length)} />
        <Stat
          label="Total present pipeline"
          value={formatCurrency(totalPipeline, { compact: true })}
          accent
        />
        <Stat
          label="Attend / sponsor"
          value={String(
            events.filter(
              (e) => e.verdict === "attend" || e.verdict === "sponsor",
            ).length,
          )}
        />
        <Stat
          label="Skip"
          value={String(events.filter((e) => e.verdict === "skip").length)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plane className="size-4 text-primary" />
            Your event calendar, ranked by pipeline on the floor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.map((e) => (
            <EventRow key={e.id} event={e} max={maxPipeline} />
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Preview only — built on top of the matcher (a sort/cluster over matched
        value, dates, geography). Worthless without the matcher; cheap with it.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xl font-semibold tabular-nums",
          accent ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EventRow({ event, max }: { event: PortfolioEvent; max: number }) {
  const width = max > 0 ? Math.round((event.matchedPipeline / max) * 100) : 0;
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{event.name}</span>
          <VerdictBadge verdict={event.verdict} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {event.location}
          </span>
          <span>{event.dates}</span>
          <span>
            {event.matchedAccounts} accounts · {event.openOpps} open
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      <div className="w-20 shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-success">
          {formatCurrency(event.matchedPipeline, { compact: true })}
        </div>
        <div className="text-[10px] text-muted-foreground">pipeline</div>
      </div>
    </div>
  );
}
