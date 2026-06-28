"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { scoreTone } from "@/lib/score";
import { useCountUp } from "./ui/useCountUp";

const TONE_COLOR = {
  go: "var(--go)",
  caution: "var(--caution)",
  skip: "var(--skip)",
} as const;

export function ScoreGauge({
  value,
  size = 168,
  label = "Schrute Score",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const tone = scoreTone(value);
  const color = TONE_COLOR[tone];
  const display = useCountUp(value);

  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // animate the arc draw after mount
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 120);
    return () => clearTimeout(t);
  }, []);
  const offset = drawn ? c - (value / 100) * c : c;

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)",
            filter: `drop-shadow(0 0 10px ${color}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className={cn("font-mono text-5xl font-semibold tabular-nums leading-none")}
            style={{ color }}
          >
            {Math.round(display)}
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
