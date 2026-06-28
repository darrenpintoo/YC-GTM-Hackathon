import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "go" | "caution" | "skip" | "signal" | "neutral";

const toneClasses: Record<Tone, string> = {
  go: "text-go bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.28)]",
  caution: "text-caution bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.28)]",
  skip: "text-skip bg-[rgba(251,113,133,0.12)] border-[rgba(251,113,133,0.28)]",
  signal: "text-signal bg-[var(--signal-dim)] border-[rgba(52,211,153,0.28)]",
  neutral: "text-muted bg-white/[0.04] border-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("panel", className)}>{children}</div>;
}

export const TONE_TEXT: Record<Tone, string> = {
  go: "text-go",
  caution: "text-caution",
  skip: "text-skip",
  signal: "text-signal",
  neutral: "text-fg",
};

export const TONE_VAR: Record<Tone, string> = {
  go: "var(--go)",
  caution: "var(--caution)",
  skip: "var(--skip)",
  signal: "var(--signal)",
  neutral: "var(--muted)",
};
