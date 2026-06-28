"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type PageTransitionProps = {
  phaseKey: string;
  children: React.ReactNode;
  className?: string;
};

/** Fade/slide wrapper for major view phase changes (intro → running → results). */
export function PageTransition({
  phaseKey,
  children,
  className,
}: PageTransitionProps) {
  return (
    <div
      key={phaseKey}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500 motion-reduce:animate-none motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
