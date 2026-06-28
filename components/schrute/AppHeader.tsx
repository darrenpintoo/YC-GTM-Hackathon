"use client";

import { Activity, Cloud, FlaskConical } from "lucide-react";

import { useDataMode } from "@/lib/data/DataModeContext";
import { cn } from "@/lib/utils";

export function AppHeader({ className }: { className?: string }) {
  const { mode, setMode } = useDataMode();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl">Schrute</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              know before you commit
            </span>
          </div>
        </div>

        <ModeToggle mode={mode} setMode={setMode} />
      </div>
    </header>
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
