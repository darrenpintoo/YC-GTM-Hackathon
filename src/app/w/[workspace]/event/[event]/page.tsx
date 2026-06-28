import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  MapPin,
  Tag,
} from "lucide-react";
import { WORKSPACES, getEvent, getWorkspace } from "@/lib/demo-data";
import { evidenceConfidence } from "@/lib/score";
import { TopNav } from "@/components/TopNav";
import { ScoreGauge } from "@/components/ScoreGauge";
import { SubScoreBars } from "@/components/SubScoreBars";
import { SignalGraph } from "@/components/SignalGraph";
import { Memo } from "@/components/Memo";
import { ConfidenceMeter, VerdictPill } from "@/components/Verdict";
import { Card, SectionLabel } from "@/components/ui/primitives";

export function generateStaticParams() {
  return WORKSPACES.flatMap((w) =>
    w.events.map((e) => ({ workspace: w.id, event: e.id })),
  );
}

export default async function EventDetail({
  params,
}: {
  params: Promise<{ workspace: string; event: string }>;
}) {
  const { workspace, event } = await params;
  const ws = getWorkspace(workspace);
  const ev = getEvent(workspace, event);
  if (!ws || !ev) notFound();

  const conf = evidenceConfidence(ev.signals);

  return (
    <>
      <TopNav workspaces={WORKSPACES} currentId={ws.id} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8">
        <Link
          href={`/w/${ws.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>

        {/* header */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4 animate-rise">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-fg">{ev.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {ev.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {ev.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> {ev.category}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CircleDollarSign className="h-3.5 w-3.5" /> {ev.costEstimate}
              </span>
            </div>
          </div>
          <a
            href={ev.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white/[0.02] px-3 py-2 text-sm text-muted hover:border-border-strong hover:text-fg"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Event page
          </a>
        </div>

        {/* verdict + scores */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col items-center justify-center p-6 text-center">
            <ScoreGauge value={ev.score.total} />
            <div className="mt-4">
              <VerdictPill verdict={ev.memo.verdict} size="lg" />
            </div>
            <div className="mt-3">
              <ConfidenceMeter value={conf} />
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <SectionLabel>Score breakdown</SectionLabel>
            <div className="mt-4">
              <SubScoreBars score={ev.score} />
            </div>
          </Card>
        </div>

        {/* signal graph — the hero */}
        <Card className="mt-4 p-6">
          <SignalGraph
            signals={ev.signals}
            closedWonCount={ws.profile.closedWonLookalikes.length}
          />
        </Card>

        {/* memo */}
        <Card className="mt-4 p-6">
          <Memo memo={ev.memo} />
        </Card>
      </main>
    </>
  );
}
