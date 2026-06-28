import {
  ArrowRight,
  CircleDollarSign,
  Flag,
  HelpCircle,
  Stamp,
  Trophy,
} from "lucide-react";
import type { DecisionMemo } from "@/lib/types";
import { VerdictPill } from "./Verdict";
import { SectionLabel } from "./ui/primitives";

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.015] p-3.5">
      <div className="flex items-center gap-1.5 text-faint">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-medium text-fg">{value}</div>
    </div>
  );
}

export function Memo({ memo }: { memo: DecisionMemo }) {
  return (
    <div>
      <SectionLabel className="flex items-center gap-2">
        <Stamp className="h-3.5 w-3.5" /> Go / No-Go Memo
      </SectionLabel>

      <div className="mt-3 flex items-center gap-3">
        <VerdictPill verdict={memo.verdict} size="lg" />
      </div>

      <h3 className="mt-3 text-xl font-semibold leading-snug text-fg">
        {memo.headline}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{memo.rationale}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {memo.sponsorThreshold && (
          <Fact
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            label="Sponsor cap"
            value={memo.sponsorThreshold}
          />
        )}
        <Fact
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Success bar"
          value={memo.successCriteria}
        />
        {memo.expectedPipeline && (
          <Fact
            icon={<Flag className="h-3.5 w-3.5" />}
            label="Est. pipeline"
            value={memo.expectedPipeline}
          />
        )}
      </div>

      {memo.missingData.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-faint">
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
              Missing data
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {memo.missingData.map((d) => (
              <span
                key={d}
                className="rounded-full border border-border bg-white/[0.02] px-2.5 py-1 text-xs text-muted"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-[rgba(52,211,153,0.28)] bg-[var(--signal-dim)] p-4">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
            Next action
          </div>
          <div className="mt-1 text-sm font-medium text-fg">{memo.nextAction}</div>
        </div>
      </div>
    </div>
  );
}
