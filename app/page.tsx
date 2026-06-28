"use client";

import * as React from "react";
import { useAction } from "convex/react";
import {
  CalendarDays,
  LayoutGrid,
  MapPin,
  Plane,
  Radar,
  RotateCcw,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { AccountBoard } from "@/components/schrute/AccountBoard";
import { AccountDrawer } from "@/components/schrute/AccountDrawer";
import { AppHeader } from "@/components/schrute/AppHeader";
import { EvidenceInspectorProvider } from "@/components/schrute/EvidenceInspector";
import { ExportBar } from "@/components/schrute/ExportBar";
import { JobProgress } from "@/components/schrute/JobProgress";
import { PortfolioPlanner } from "@/components/schrute/PortfolioPlanner";
import { ResultsSummary } from "@/components/schrute/ResultsSummary";
import { RevenueProfilePanel } from "@/components/schrute/RevenueProfilePanel";
import { UploadIntro, type IntroPayload } from "@/components/schrute/UploadIntro";
import { VerdictMemo } from "@/components/schrute/VerdictMemo";
import { FailedState } from "@/components/schrute/atoms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_SCENARIOS, type DemoScenarioKey } from "@/lib/data/demoBundle";
import { useDataMode } from "@/lib/data/DataModeContext";
import { useEventBundle, type EventBundle } from "@/lib/data/useEventBundle";
import type { AccountMatch, Job, JobStep } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type Phase = "intro" | "running" | "results";

const SIM_STEPS: { step: JobStep; message: string }[] = [
  { step: "ingest", message: "Exhibitor directory loaded" },
  { step: "extract", message: "142 exhibitors parsed" },
  { step: "match", message: "Matching against your CRM…" },
  { step: "score", message: "Underwriting break-even" },
  { step: "memo", message: "Drafting the memo" },
];

export default function Home() {
  const seedDemo = useAction(api.orchestrate.seedDemo);
  const { mode, scenario } = useDataMode();
  const { bundle, isLoading, hasResults } = useEventBundle();

  const [phase, setPhase] = React.useState<Phase>("intro");
  const [simJobs, setSimJobs] = React.useState<Job[]>([]);
  const [selected, setSelected] = React.useState<AccountMatch | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Live mode: once Convex has scored the event, reveal the board.
  React.useEffect(() => {
    if (mode === "live" && phase === "running" && hasResults) {
      setPhase("results");
    }
  }, [mode, phase, hasResults]);

  // Switching data source / scenario mid-demo: close the drawer cleanly.
  React.useEffect(() => {
    setSelected(null);
    setDrawerOpen(false);
  }, [mode, scenario]);

  function runMockSimulation(eventId: string) {
    let i = 0;
    const tick = () => {
      const jobs: Job[] = SIM_STEPS.map((s, idx) => ({
        _id: `sim_${s.step}`,
        eventId,
        step: s.step,
        status: idx < i ? "completed" : idx === i ? "running" : "pending",
        message: idx <= i ? s.message : undefined,
        progress: idx < i ? 100 : idx === i ? 55 : 0,
        updatedAt: Date.now(),
      }));
      jobs.push({
        _id: "sim_enrich",
        eventId,
        step: "enrich",
        status: i >= SIM_STEPS.length ? "running" : "pending",
        message: i >= SIM_STEPS.length ? "Fiber enrichment (sidecar)" : undefined,
        progress: i >= SIM_STEPS.length ? 40 : 0,
        updatedAt: Date.now(),
      });
      setSimJobs(jobs);
      i += 1;
      if (i <= SIM_STEPS.length) {
        timer.current = setTimeout(tick, 750);
      } else {
        timer.current = setTimeout(() => setPhase("results"), 650);
      }
    };
    tick();
  }

  async function handleRun(payload: IntroPayload) {
    setError(null);
    setPhase("running");
    setSimJobs([]);
    toast(`Reading ${payload.eventName} against ${payload.companyCount} accounts…`);

    if (mode === "mock") {
      runMockSimulation(bundle?.event._id ?? "mock_event");
      return;
    }

    try {
      await seedDemo({});
      toast.success("Pipeline complete");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run failed";
      setError(message);
      toast.error(message);
      setPhase("intro");
    }
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setPhase("intro");
    setSimJobs([]);
    setSelected(null);
    setDrawerOpen(false);
  }

  function openMatch(match: AccountMatch) {
    setSelected(match);
    setDrawerOpen(true);
  }

  const jobsForRunning = mode === "mock" ? simJobs : bundle?.jobs ?? [];

  return (
    <EvidenceInspectorProvider sourceDocuments={bundle?.sourceDocuments ?? []}>
      <div className="min-h-screen">
        <AppHeader />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {error ? (
            <div className="mb-6">
              <FailedState title="Pipeline failed" description={error} />
            </div>
          ) : null}

          {phase === "intro" ? (
            <UploadIntro running={false} onRun={handleRun} />
          ) : null}

          {phase === "running" ? (
            <RunningView
              bundle={bundle}
              jobs={jobsForRunning}
              loading={isLoading}
            />
          ) : null}

          {phase === "results" && bundle ? (
            <ResultsView
              bundle={bundle}
              selectedId={selected?._id ?? null}
              onSelect={openMatch}
              onReset={reset}
            />
          ) : null}

          {phase === "results" && !bundle ? (
            <FailedState
              title="No live data yet"
              description="Live mode is selected but the deployment has no scored event. Run the pipeline or switch to Demo mode."
            />
          ) : null}
        </main>

        <AccountDrawer
          match={selected}
          contacts={bundle?.contacts ?? []}
          outreachDrafts={bundle?.outreachDrafts ?? []}
          eventName={bundle?.event.name}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
    </EvidenceInspectorProvider>
  );
}

function RunningView({
  bundle,
  jobs,
  loading,
}: {
  bundle: EventBundle | null;
  jobs: Job[];
  loading: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        {bundle ? (
          <RevenueProfilePanel
            profile={bundle.revenueProfile}
            accounts={bundle.crmAccounts}
          />
        ) : (
          <Skeleton className="h-80 w-full rounded-xl" />
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="size-4 animate-pulse text-primary" />
            Reading the floor…
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Matching public event evidence against your pipeline.
          </p>
        </CardHeader>
        <CardContent>
          {loading && jobs.length === 0 ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <JobProgress jobs={jobs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsView({
  bundle,
  selectedId,
  onSelect,
  onReset,
}: {
  bundle: EventBundle;
  selectedId: string | null;
  onSelect: (m: AccountMatch) => void;
  onReset: () => void;
}) {
  const { event, matches, score, memo, contacts, outreachDrafts } = bundle;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <EventTitle event={event} />
        <div className="flex items-center gap-2">
          <ScenarioSwitcher />
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" />
            New run
          </Button>
        </div>
      </div>

      <Tabs defaultValue="event" className="gap-5">
        <TabsList>
          <TabsTrigger value="event">
            <LayoutGrid className="size-4" />
            This event
          </TabsTrigger>
          <TabsTrigger value="portfolio">
            <Plane className="size-4" />
            Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="event" className="space-y-5">
          {score ? (
            <ResultsSummary score={score} matches={matches} memo={memo} />
          ) : null}

          <ExportBar
            event={event}
            matches={matches}
            contacts={contacts}
            outreachDrafts={outreachDrafts}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Your accounts on the floor
              </h2>
              <AccountBoard
                matches={matches}
                contacts={contacts}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </div>

            <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              <VerdictMemo score={score} memo={memo} />
              <RevenueProfilePanel
                profile={bundle.revenueProfile}
                accounts={bundle.crmAccounts}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="portfolio">
          <PortfolioPlanner />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScenarioSwitcher() {
  const { mode, scenario, setScenario } = useDataMode();
  if (mode !== "mock") return null;

  const keys = Object.keys(DEMO_SCENARIOS) as DemoScenarioKey[];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-xs">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => setScenario(k)}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors",
            scenario === k
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {k === "attend" ? "Attend demo" : "Skip demo"}
        </button>
      ))}
    </div>
  );
}

function EventTitle({ event }: { event: EventBundle["event"] }) {
  const dates =
    event.startDate && event.endDate
      ? `${event.startDate} → ${event.endDate}`
      : (event.startDate ?? "");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {dates ? (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {dates}
          </span>
        ) : null}
        {event.location ? (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {event.location}
          </span>
        ) : null}
        {event.sponsorQuote ? (
          <span className="flex items-center gap-1.5">
            <Ticket className="size-3.5" />
            {formatCurrency(event.sponsorQuote)} sponsor quote
          </span>
        ) : null}
      </div>
    </div>
  );
}
