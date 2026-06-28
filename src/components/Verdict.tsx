import { cn } from "@/lib/cn";
import { VERDICT_META, confidenceLabel } from "@/lib/score";
import type { Verdict } from "@/lib/types";

const toneStyle = {
  go: "text-go border-[rgba(52,211,153,0.4)] bg-[rgba(52,211,153,0.12)]",
  caution: "text-caution border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.12)]",
  skip: "text-skip border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.12)]",
} as const;

export function VerdictPill({
  verdict,
  size = "md",
}: {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
}) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold",
        toneStyle[meta.tone],
        size === "lg" && "px-4 py-1.5 text-sm",
        size === "md" && "px-3 py-1 text-xs",
        size === "sm" && "px-2.5 py-0.5 text-[11px]",
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {meta.label}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const label = confidenceLabel(value);
  const segments = 5;
  const lit = Math.round(value * segments);
  const color =
    value >= 0.62 ? "var(--go)" : value >= 0.42 ? "var(--caution)" : "var(--skip)";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className="h-3.5 w-1.5 rounded-full"
            style={{
              background: i < lit ? color : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>
      <span className="font-mono text-xs capitalize text-muted">{label} confidence</span>
    </div>
  );
}
