"use client";

import { Activity, Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { USE_MOCKS } from "@/lib/data/useEventBundle";
import { cn } from "@/lib/utils";

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">Schrute</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              the buyers already in the building
            </span>
          </div>
        </div>

        <Badge
          variant={USE_MOCKS ? "secondary" : "success"}
          className="font-mono"
        >
          <Database className="size-3" />
          {USE_MOCKS ? "mock data" : "live · convex"}
        </Badge>
      </div>
    </header>
  );
}
