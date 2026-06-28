"use client";

import * as React from "react";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileSearch,
  LayoutGrid,
  MapPin,
  Plane,
  Radar,
  RotateCcw,
  Ticket,
  Users,
} from "lucide-react";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { AccountBoard } from "@/components/schrute/AccountBoard";
import { AccountDrawer } from "@/components/schrute/AccountDrawer";
import { AppHeader } from "@/components/schrute/AppHeader";
import { AttendeeList } from "@/components/schrute/AttendeeList";
import { EvidenceInspectorProvider } from "@/components/schrute/EvidenceInspector";
import { ExportBar } from "@/components/schrute/ExportBar";
import { JobProgress } from "@/components/schrute/JobProgress";
import { OutcomeWheel } from "@/components/schrute/OutcomeWheel";
import { ParticipationVerdict } from "@/components/schrute/ParticipationVerdict";
import { PageTransition } from "@/components/schrute/PageTransition";
import { PortfolioPlanner } from "@/components/schrute/PortfolioPlanner";
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
import { useEventBundle, DEMO_EVENT_SLUG, type EventBundle } from "@/lib/data/useEventBundle";
import type { ObjectiveKey, ParticipationKey } from "@/lib/objectives";
import type { AccountMatch, Job, JobStep } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

export type RunIntent = {
  objective: ObjectiveKey | null;
  options: ParticipationKey[];
  repCount?: number;
};

type Phase = "intro" | "running" | "results";

const SIM_STEPS: { step: JobStep; message: string }[] = [
  { step: "ingest", message: "Exhibitor directory loaded" },
  { step: "extract", message: "142 exhibitors parsed" },
  { step: "match", message: "Matching against your CRM…" },
  { step: "score", message: "Underwriting break-even" },
  { step: "memo", message: "Drafting the memo" },
];

export default function Home() {
  const startRun = useAction(api.orchestrate.startRun);
  const { mode, scenario } = useDataMode();
  const [runSlug, setRunSlug] = React.useState<string | null>(null);
  const { bundle, isLoading } = useEventBundle(
    mode === "live" ? (runSlug ?? DEMO_EVENT_SLUG) : undefined,
  );

  const [phase, setPhase] = React.useState<Phase>("intro");
  const [simJobs, setSimJobs] = React.useState<Job[]>([]);
  const [selected, setSelected] = React.useState<AccountMatch | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = React.useState(false);
  const [intent, setIntent] = React.useState<RunIntent>({
    objective: "spend_decision",
    options: ["attend", "exhibit"],
  });
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Switching data source / scenario mid-demo: close the drawer cleanly.
  React.useEffect(() => {
    setSelected(null);
    setDrawerOpen(false);
  }, [mode, scenario]);

  // Live mode: stream job rows and transition to results only when the real
  // pipeline reaches the memo step (or surface an error if a step fails).
  React.useEffect(() => {
    if (mode !== "live" || phase !== "running" || !runSlug) return;
    if (!bundle || bundle.event.slug !== runSlug) return;

    const failed = bundle.jobs.find((j) => j.status === "failed");
    if (failed) {
      setError(failed.error || `Pipeline failed at the ${failed.step} step`);
      toast.error("Pipeline failed");
      setPhase("intro");
      setPipelineRunning(false);
      return;
    }

    const memo = bundle.jobs.find((j) => j.step === "memo");
    if (memo?.status === "completed" && bundle.score) {
      setPhase("results");
      setPipelineRunning(false);
      const n = bundle.matches.length;
      toast.success(
        `Pipeline complete — ${n} account${n === 1 ? "" : "s"} matched`,
      );
    }
  }, [mode, phase, runSlug, bundle]);

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
    setIntent({
      objective: payload.objective,
      options: payload.options,
      repCount: payload.repCount,
    });
    toast(`Reading ${payload.eventName} against ${payload.companyCount} accounts…`);

    if (mode === "mock") {
      setPipelineRunning(false);
      runMockSimulation(bundle?.event._id ?? "mock_event");
      return;
    }

    // Live: kick off the pipeline, point at the new event, then let job rows
    // stream in. The transition-to-results effect handles completion.
    setPipelineRunning(true);
    setRunSlug(null);
    try {
      const result = await startRun({
        csvText: payload.csvText,
        eventName: payload.eventName,
        eventSource: payload.eventSource,
        sponsorQuote: payload.sponsorQuote || undefined,
        objective: payload.objective ?? undefined,
        participationOptions: payload.options,
        repCount: payload.repCount,
      });
      setRunSlug(result.slug);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run failed";
      setError(message);
      toast.error(message);
      setPhase("intro");
      setPipelineRunning(false);
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

  const liveRunJobs =
    runSlug && bundle?.event.slug === runSlug ? bundle.jobs : [];
  const jobsForRunning = mode === "mock" ? simJobs : liveRunJobs;

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
            <PageTransition phaseKey="intro">
              <UploadIntro running={false} onRun={handleRun} />
            </PageTransition>
          ) : null}

          {phase === "running" ? (
            <PageTransition phaseKey="running">
              <RunningView
                bundle={bundle}
                jobs={jobsForRunning}
                loading={isLoading || pipelineRunning}
                mode={mode}
              />
            </PageTransition>
          ) : null}

          {phase === "results" && bundle ? (
            <PageTransition phaseKey="results">
              <ResultsView
                bundle={bundle}
                intent={intent}
                mode={mode}
                selectedId={selected?._id ?? null}
                onSelect={openMatch}
                onReset={reset}
              />
            </PageTransition>
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
  mode,
}: {
  bundle: EventBundle | null;
  jobs: Job[];
  loading: boolean;
  mode: "mock" | "live";
}) {
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const [stepPulse, setStepPulse] = React.useState(false);
  const prevCompleted = React.useRef(completedCount);

  React.useEffect(() => {
    if (completedCount > prevCompleted.current) {
      setStepPulse(true);
      const timer = window.setTimeout(() => setStepPulse(false), 700);
      prevCompleted.current = completedCount;
      return () => window.clearTimeout(timer);
    }
    prevCompleted.current = completedCount;
    return undefined;
  }, [completedCount]);

  return (
    <div className="space-y-4">
      {mode === "live" ? (
        <LivePipelineNotice
          detail="Deep research: we map the event site, search the open web for sponsor/exhibitor/speaker pages, scrape the most relevant ones, then extract companies, write the memo, and find attendees. Steps stream below (~45–120s)."
        />
      ) : null}
      {mode === "live" && bundle && bundle.sourceDocuments.length > 0 ? (
        <GatheredSourcesLive sources={bundle.sourceDocuments} />
      ) : null}
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
        <CardContent
          className={cn(
            "rounded-lg transition-colors duration-500 motion-reduce:transition-none",
            stepPulse && "bg-success/5",
          )}
        >
          {loading && jobs.length === 0 ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <JobProgress jobs={jobs} />
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function LivePipelineNotice({ detail }: { detail: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-success" />
      <div>
        <span className="font-medium text-foreground">Live · real pipeline</span>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function MockEnrichmentNotice() {
  return (
    <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Demo enrichment data.</span>{" "}
        No public attendance signals were found yet, so contacts, outreach
        drafts, and social-post attendees are showing curated samples. Matches,
        score, and memo are from the live Convex pipeline.
      </p>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  sponsors: "Sponsors",
  exhibitors: "Exhibitors",
  speakers: "Speakers",
  program: "Program",
  news: "News / Press",
  event: "Event page",
  other: "Other",
};

function hostFromUrl(url?: string): string {
  if (!url) return "source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function GatheredSourcesLive({
  sources,
}: {
  sources: EventBundle["sourceDocuments"];
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <FileSearch className="size-3.5 text-primary" />
        Sources gathered ({sources.length})
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <span
            key={s._id}
            className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {hostFromUrl(s.url)}
            {s.category ? (
              <span className="ml-1 text-foreground/60">
                · {CATEGORY_LABEL[s.category] ?? s.category}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function ThinCorpusNotice() {
  return (
    <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          Limited public data for this event.
        </span>{" "}
        No published sponsor or exhibitor list was found, so matches may be thin.
        Try linking a specific sponsors/exhibitors page, or paste the exhibitor
        directory directly for a deeper read.
      </p>
    </div>
  );
}

function SourcesPanel({
  sources,
}: {
  sources: EventBundle["sourceDocuments"];
}) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sources were gathered for this run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Every page Schrute read while researching this event. Companies and
        attendees are cited back to these sources.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((s) => (
          <Card key={s._id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.category ? (CATEGORY_LABEL[s.category] ?? s.category) : "Source"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {(s.textContent?.length ?? 0).toLocaleString()} chars
                </span>
              </div>
              <p className="text-sm font-medium leading-snug text-foreground">
                {s.title || hostFromUrl(s.url)}
              </p>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {hostFromUrl(s.url)}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {s.kind === "snapshot" ? "Cached snapshot" : "Pasted source"}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ResultsView({
  bundle,
  intent,
  mode,
  selectedId,
  onSelect,
  onReset,
}: {
  bundle: EventBundle;
  intent: RunIntent;
  mode: "mock" | "live";
  selectedId: string | null;
  onSelect: (m: AccountMatch) => void;
  onReset: () => void;
}) {
  const {
    event,
    matches,
    score,
    memo,
    contacts,
    outreachDrafts,
    attendees,
    sourceDocuments,
  } = bundle;

  // Thin corpus: little usable public text gathered, so matches may be sparse.
  const corpusChars = sourceDocuments.reduce(
    (sum, s) => sum + (s.textContent?.length ?? 0),
    0,
  );
  const onlyFallbackSources = sourceDocuments.every(
    (s) => s.kind === "snapshot" || s.kind === "paste",
  );
  const isThinCorpus =
    mode === "live" &&
    (corpusChars < 1500 || (matches.length === 0 && onlyFallbackSources));

  return (
    <div className="space-y-6">
      {mode === "live" && isThinCorpus ? <ThinCorpusNotice /> : null}
      {mode === "live" && bundle.usesMockEnrichment ? (
        <MockEnrichmentNotice />
      ) : null}
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

      <Tabs defaultValue="event" className="gap-6">
        <TabsList>
          <TabsTrigger value="event">
            <LayoutGrid className="size-4" />
            Outcome
          </TabsTrigger>
          <TabsTrigger value="people">
            <Users className="size-4" />
            People ({attendees.length})
          </TabsTrigger>
          <TabsTrigger value="sources">
            <FileSearch className="size-4" />
            Sources ({sourceDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="portfolio">
            <Plane className="size-4" />
            Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="event"
          className="animate-in fade-in duration-300 motion-reduce:animate-none space-y-6"
        >
          {score ? (
            <OutcomeWheel
              event={event}
              score={score}
              matches={matches}
              memo={memo}
              attendees={attendees}
              contacts={contacts}
              outreachDrafts={outreachDrafts}
              onOpenAccount={onSelect}
            />
          ) : null}

          {score ? (
            <ParticipationVerdict
              objective={intent.objective}
              options={intent.options}
              score={score}
              event={event}
              matches={matches}
              repCount={intent.repCount}
            />
          ) : null}

          <ExportBar
            event={event}
            matches={matches}
            contacts={contacts}
            outreachDrafts={outreachDrafts}
          />

          <div id="accounts-board" className="grid gap-6 lg:grid-cols-3 scroll-mt-24">
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

        <TabsContent
          value="people"
          className="animate-in fade-in duration-300 motion-reduce:animate-none space-y-4"
        >
          <div>
            <h2 className="font-display text-2xl">Who&apos;s posting about going</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Prospective attendees surfaced from public social posts, tied back
              to your accounts.
              {bundle.usesMockEnrichment
                ? " Showing demo samples — not yet from a live social-data source."
                : ""}
            </p>
          </div>
          <AttendeeList attendees={attendees} />
        </TabsContent>

        <TabsContent
          value="sources"
          className="animate-in fade-in duration-300 motion-reduce:animate-none space-y-4"
        >
          <div>
            <h2 className="font-display text-2xl">Sources we read</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              The pages gathered during deep research for this event.
            </p>
          </div>
          <SourcesPanel sources={sourceDocuments} />
        </TabsContent>

        <TabsContent
          value="portfolio"
          className="animate-in fade-in duration-300 motion-reduce:animate-none"
        >
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
      <h1 className="font-display text-3xl">{event.name}</h1>
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
