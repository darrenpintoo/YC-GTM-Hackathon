import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, Sparkles } from "lucide-react";
import type { EventEval } from "@/lib/types";
import { evidenceConfidence } from "@/lib/score";
import { ScoreDial } from "./ScoreDial";
import { VerdictPill } from "./Verdict";

export function EventCard({
  workspaceId,
  event,
}: {
  workspaceId: string;
  event: EventEval;
}) {
  const matched = event.signals.filter((s) => s.lookalikeOf);
  const matchedNames = [...new Set(matched.map((s) => s.lookalikeOf!))].slice(0, 4);
  const companies = event.signals.filter((s) => s.company && s.company !== "—");
  const conf = evidenceConfidence(event.signals);

  return (
    <Link
      href={`/w/${workspaceId}/event/${event.id}`}
      className="group block rounded-2xl border border-border bg-gradient-to-b from-panel-2 to-panel p-5 transition hover:border-border-strong hover:from-elevated"
    >
      <div className="flex items-start gap-4">
        <ScoreDial value={event.score.total} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-fg">{event.name}</h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {event.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {event.date}
                </span>
                <span className="font-mono">{event.category}</span>
              </div>
            </div>
            <VerdictPill verdict={event.memo.verdict} />
          </div>

          <p className="mt-2.5 line-clamp-2 text-sm text-muted">{event.blurb}</p>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 font-mono text-[11px] text-faint">
              <span>
                <span className="text-muted">{companies.length}</span> companies
              </span>
              <span className="text-signal">
                {matched.length} matches
              </span>
              <span>{Math.round(conf * 100)}% conf</span>
            </div>
            {matchedNames.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-signal" />
                {matchedNames.map((n) => (
                  <span
                    key={n}
                    className="rounded-md border border-[rgba(52,211,153,0.22)] bg-[var(--signal-dim)] px-1.5 py-0.5 text-[11px] text-signal"
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />
      </div>
    </Link>
  );
}
