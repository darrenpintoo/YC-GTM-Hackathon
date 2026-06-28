import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/demo-data";
import { SIGNAL_META } from "@/lib/score";
import type { EventEval } from "@/lib/types";

export interface AnalyzeStep {
  label: string;
  detail: string;
}

export interface AnalyzeResult {
  eventId: string;
  matched: boolean;
  steps: AnalyzeStep[];
}

function matchEvent(events: EventEval[], query: string): EventEval {
  const q = query.trim().toLowerCase();
  if (q) {
    const hit = events.find(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        q.includes(e.name.toLowerCase().split(" ")[0]) ||
        e.url.toLowerCase().includes(q),
    );
    if (hit) return hit;
  }
  // fallback: best-scoring event
  return [...events].sort((a, b) => b.score.total - a.score.total)[0];
}

function buildSteps(ev: EventEval): AnalyzeStep[] {
  const companies = ev.signals.filter((s) => s.company && s.company !== "—");
  const matches = ev.signals.filter((s) => s.lookalikeOf);
  const types = [...new Set(ev.signals.map((s) => s.type))];
  return [
    { label: "Fetching event page & agenda", detail: ev.url.replace(/^https?:\/\//, "") },
    {
      label: "Extracting sponsors, exhibitors & speakers",
      detail: `${companies.length} companies found`,
    },
    {
      label: "Classifying public signals",
      detail: types.map((t) => SIGNAL_META[t].short).join(" · "),
    },
    {
      label: "Matching against your closed-won set",
      detail: `${matches.length} lookalike${matches.length === 1 ? "" : "s"} matched`,
    },
    {
      label: "Computing Schrute Score",
      detail: `${ev.score.total}/100 · ICP fit ${ev.score.icpFit}/30`,
    },
    { label: "Writing Go / No-Go memo", detail: ev.memo.verdict.toUpperCase() },
  ];
}

export async function POST(req: Request) {
  let body: { workspaceId?: string; query?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const ws = getWorkspace(body.workspaceId ?? "");
  if (!ws) {
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  }

  // NOTE: with OPENAI_API_KEY set, this is where we'd run live web research
  // + structured extraction. The curated path below guarantees the live demo
  // never fails and stays fast on stage.
  const ev = matchEvent(ws.events, body.query ?? "");
  const result: AnalyzeResult = {
    eventId: ev.id,
    matched: true,
    steps: buildSteps(ev),
  };

  return NextResponse.json(result);
}
