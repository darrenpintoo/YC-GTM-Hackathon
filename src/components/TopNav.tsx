"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";

export function TopNav({
  workspaces,
  currentId,
}: {
  workspaces: Pick<Workspace, "id" | "name" | "context">[];
  currentId: string;
}) {
  const [open, setOpen] = useState(false);
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[rgba(7,8,11,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href={`/w/${currentId}`} className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-tight text-fg">
              Schrute<span className="text-signal">.</span>AI
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Event Intelligence
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* workspace switcher */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-white/[0.02] px-3 py-2 text-left hover:border-border-strong"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--signal-dim)] font-mono text-xs font-semibold text-signal">
                {current.name.slice(0, 1)}
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-medium leading-none text-fg">
                  {current.name}
                </span>
                <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-faint">
                  {current.context}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-faint" />
            </button>

            {open && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border-strong bg-elevated shadow-2xl shadow-black/50">
                <div className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  Workspaces
                </div>
                {workspaces.map((w) => (
                  <Link
                    key={w.id}
                    href={`/w/${w.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04]",
                      w.id === currentId && "bg-white/[0.02]",
                    )}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--signal-dim)] font-mono text-xs font-semibold text-signal">
                      {w.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        {w.name}
                      </span>
                      <span className="block truncate text-[11px] text-faint">
                        {w.context}
                      </span>
                    </span>
                    {w.id === currentId && <Check className="h-4 w-4 text-signal" />}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/w/${currentId}/analyze`}
            className="hidden items-center gap-2 rounded-xl bg-gradient-to-r from-signal to-signal-2 px-3.5 py-2 text-sm font-semibold text-[#05140d] shadow-lg shadow-[rgba(52,211,153,0.2)] hover:opacity-95 sm:flex"
          >
            <Plus className="h-4 w-4" />
            Analyze event
          </Link>
        </div>
      </div>
    </header>
  );
}
