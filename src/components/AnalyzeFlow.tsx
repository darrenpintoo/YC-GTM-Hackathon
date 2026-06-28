"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2, Radar, Search } from "lucide-react";
import type { AnalyzeResult, AnalyzeStep } from "@/app/api/analyze/route";
import { cn } from "@/lib/cn";
import { SectionLabel } from "./ui/primitives";

export function AnalyzeFlow({
  workspaceId,
  examples,
}: {
  workspaceId: string;
  examples: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [steps, setSteps] = useState<AnalyzeStep[]>([]);
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  async function run(q: string) {
    if (phase === "running") return;
    setLabel(q);
    setPhase("running");
    setSteps([]);
    setCompleted(0);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, query: q }),
    });
    const data: AnalyzeResult = await res.json();
    setTarget(data.eventId);
    setSteps(data.steps);
  }

  // drive the step ticker
  useEffect(() => {
    if (phase !== "running" || steps.length === 0) return;
    const id = setInterval(() => {
      setCompleted((c) => {
        if (c + 1 >= steps.length) clearInterval(id);
        return c + 1;
      });
    }, 820);
    return () => clearInterval(id);
  }, [steps, phase]);

  // finish + navigate
  useEffect(() => {
    if (phase === "running" && steps.length > 0 && completed >= steps.length) {
      setPhase("done");
      const t = setTimeout(() => {
        if (target) router.push(`/w/${workspaceId}/event/${target}`);
      }, 750);
      return () => clearTimeout(t);
    }
  }, [completed, steps, phase, target, router, workspaceId]);

  const running = phase !== "idle";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center animate-rise">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(52,211,153,0.28)] bg-[var(--signal-dim)]">
          <Radar className="h-7 w-7 text-signal" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">
          Analyze an event
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Paste an event and Schrute researches the public evidence, matches it to your
          pipeline, and returns a verdict.
        </p>
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) run(query);
        }}
        className="mt-6"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-white/[0.02] p-2 focus-within:border-border-strong">
          <Search className="ml-2 h-4 w-4 shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={running}
            placeholder="Paste an event URL or name…  e.g. SaaStr Annual"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={running || !query.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-signal to-signal-2 px-4 py-2 text-sm font-semibold text-[#05140d] disabled:opacity-40"
          >
            Research <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* example chips */}
      {!running && (
        <div className="mt-4">
          <SectionLabel className="mb-2">Candidate events</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex.id}
                onClick={() => run(ex.name)}
                className="rounded-full border border-border bg-white/[0.02] px-3 py-1.5 text-xs text-muted hover:border-border-strong hover:text-fg"
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* research theater */}
      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-panel-2 to-panel p-5"
          >
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-[var(--signal-dim)]">
                <Radar className="h-4 w-4 text-signal" />
                <span className="absolute inset-0 animate-ping rounded-lg border border-[rgba(52,211,153,0.4)]" />
              </span>
              <div>
                <div className="text-sm font-medium text-fg">
                  {phase === "done" ? "Report ready" : "Researching"} ·{" "}
                  <span className="text-muted">{label}</span>
                </div>
                <div className="font-mono text-[11px] text-faint">
                  agentic research · public sources
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              {steps.length === 0 && (
                <div className="flex items-center gap-2 py-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-signal" /> Spinning up
                  research agent…
                </div>
              )}
              {steps.map((s, i) => {
                const state = i < completed ? "done" : i === completed ? "active" : "pending";
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-2 transition",
                      state === "active" && "bg-white/[0.03]",
                      state === "pending" && "opacity-40",
                    )}
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center">
                      {state === "done" ? (
                        <Check className="h-4 w-4 text-signal" />
                      ) : state === "active" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-signal" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                      )}
                    </span>
                    <span className="flex-1 text-sm text-fg">{s.label}</span>
                    {state !== "pending" && (
                      <span className="font-mono text-[11px] text-faint">{s.detail}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "done" && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[rgba(52,211,153,0.28)] bg-[var(--signal-dim)] py-2.5 text-sm font-medium text-signal">
                <Check className="h-4 w-4" /> Opening report…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
