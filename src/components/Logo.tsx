export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="schrute-g" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="var(--signal)" />
          <stop offset="1" stopColor="var(--signal-2)" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill="url(#schrute-g)"
        opacity="0.12"
      />
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#schrute-g)" strokeOpacity="0.45" />
      {/* radar / signal sweep */}
      <path d="M16 22a6 6 0 1 0-6-6" stroke="url(#schrute-g)" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 26a10 10 0 1 0-10-10" stroke="url(#schrute-g)" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.45" />
      <circle cx="16" cy="16" r="2.5" fill="url(#schrute-g)" />
    </svg>
  );
}
