import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown, Plus, Sparkles } from "lucide-react";
import { WORKSPACES, getWorkspace } from "@/lib/demo-data";
import { TopNav } from "@/components/TopNav";
import { RevenueProfileCard } from "@/components/RevenueProfileCard";
import { EventCard } from "@/components/EventCard";
import { SectionLabel } from "@/components/ui/primitives";

export function generateStaticParams() {
  return WORKSPACES.map((w) => ({ workspace: w.id }));
}

export default async function Dashboard({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const ws = getWorkspace(workspace);
  if (!ws) notFound();

  const events = [...ws.events].sort((a, b) => b.score.total - a.score.total);
  const totalCompanies = ws.events.reduce(
    (n, e) => n + e.signals.filter((s) => s.company && s.company !== "—").length,
    0,
  );
  const totalMatches = ws.events.reduce(
    (n, e) => n + e.signals.filter((s) => s.lookalikeOf).length,
    0,
  );
  const attendCount = ws.events.filter((e) =>
    ["attend", "sponsor"].includes(e.memo.verdict),
  ).length;

  return (
    <>
      <TopNav workspaces={WORKSPACES} currentId={ws.id} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8">
        {/* hero */}
        <div className="animate-rise">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-[34px]">
                Before you buy the booth,{" "}
                <span className="text-gradient">ask Schrute.</span>
              </h1>
              <p className="mt-2 max-w-2xl text-[15px] text-muted">
                {ws.events.length} events scored against{" "}
                <span className="text-fg">{ws.profile.company}</span>&rsquo;s pipeline —
                ranked by evidence, not vibes.
              </p>
            </div>
            <Link
              href={`/w/${ws.id}/analyze`}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-signal to-signal-2 px-4 py-2.5 text-sm font-semibold text-[#05140d] shadow-lg shadow-[rgba(52,211,153,0.2)] hover:opacity-95"
            >
              <Plus className="h-4 w-4" /> Analyze event
            </Link>
          </div>

          {/* stat strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={`${ws.events.length}`} label="Events scored" />
            <Stat value={`${totalCompanies}`} label="Companies surfaced" />
            <Stat value={`${totalMatches}`} label="Closed-won matches" accent />
            <Stat value={`${attendCount}`} label="Worth your budget" />
          </div>
        </div>

        {/* body */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <RevenueProfileCard profile={ws.profile} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5" /> Ranked by Schrute Score
              </SectionLabel>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-faint">
                <Sparkles className="h-3 w-3 text-signal" /> evidence-backed
              </span>
            </div>
            <div className="space-y-3">
              {events.map((e) => (
                <EventCard key={e.id} workspaceId={ws.id} event={e} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.015] px-4 py-3.5">
      <div
        className="font-mono text-2xl font-semibold tabular-nums"
        style={{ color: accent ? "var(--signal)" : "var(--fg)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-faint">{label}</div>
    </div>
  );
}
