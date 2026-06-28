"use client";

import { Activity, Cloud, FlaskConical } from "lucide-react";

import { DEMO_SCENARIOS, type DemoScenarioKey } from "@/lib/data/demoBundle";
import { useDataMode } from "@/lib/data/DataModeContext";
import { cn } from "@/lib/utils";

export function AppHeader({ className }: { className?: string }) {
  const { mode, setMode, scenario, setScenario } = useDataMode();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-xl">Schrute</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              know before you commit
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mode === "mock" ? (
            <ScenarioSwitcher scenario={scenario} setScenario={setScenario} />
          ) : null}
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
      </div>
    </header>
  );
}

function ScenarioSwitcher({
  scenario,
  setScenario,
}: {
  scenario: DemoScenarioKey;
  setScenario: (k: DemoScenarioKey) => void;
}) {
  const keys = Object.keys(DEMO_SCENARIOS) as DemoScenarioKey[];

  return (
    <div className="hidden items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-xs sm:flex">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => setScenario(k)}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors",
            scenario === k
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {k === "attend" ? "Attend" : "Skip"}
        </button>
      ))}
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "mock" | "live";
  setMode: (m: "mock" | "live") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-xs">
      <button
        type="button"
        onClick={() => setMode("mock")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
          mode === "mock"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <FlaskConical className="size-3.5" />
        Demo · curated
      </button>
      <button
        type="button"
        onClick={() => setMode("live")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
          mode === "live"
            ? "bg-success/20 text-success"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Cloud className="size-3.5" />
        Live · pipeline
      </button>
    </div>
  );
}
