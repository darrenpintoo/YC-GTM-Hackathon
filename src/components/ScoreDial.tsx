import { scoreTone } from "@/lib/score";

const TONE_COLOR = {
  go: "var(--go)",
  caution: "var(--caution)",
  skip: "var(--skip)",
} as const;

/** Static (non-animated) compact score ring for cards/lists. */
export function ScoreDial({ value, size = 64 }: { value: number; size?: number }) {
  const tone = scoreTone(value);
  const color = TONE_COLOR[tone];
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
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
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <span
        className="absolute font-mono text-lg font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
