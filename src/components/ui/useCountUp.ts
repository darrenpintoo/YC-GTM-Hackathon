"use client";

import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Count up to `target` over `duration` ms once the element is ready. */
export function useCountUp(target: number, duration = 1100, delay = 120) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setValue(target * easeOutCubic(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };

    timeout = setTimeout(() => {
      raf.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay]);

  return value;
}
