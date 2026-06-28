"use client";

import { useEffect, useState } from "react";
import type { EventScore } from "@/lib/types";
import { SUBSCORE_META, WEIGHTS } from "@/lib/score";

function ratioColor(r: number) {
  if (r >= 0.7) return "var(--go)";
  if (r >= 0.45) return "var(--caution)";
  return "var(--skip)";
}

export function SubScoreBars({ score }: { score: EventScore }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-4">
      {SUBSCORE_META.map((m, i) => {
        const max = WEIGHTS[m.key];
        const val = score[m.key];
        const ratio = val / max;
        const color = ratioColor(ratio);
        return (
          <div key={m.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-fg">{m.label}</span>
              <span className="font-mono text-xs tabular-nums text-muted">
                {val}
                <span className="text-faint">/{max}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full"
                style={{
                  width: mounted ? `${ratio * 100}%` : "0%",
                  background: color,
                  boxShadow: `0 0 8px ${color}66`,
                  transition: `width 0.9s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms`,
                }}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{m.blurb}</div>
          </div>
        );
      })}
    </div>
  );
}
