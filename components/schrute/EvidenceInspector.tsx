"use client";

import * as React from "react";
import { ExternalLink, FileText, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Evidence, SourceDocument } from "@/lib/types";

type InspectorValue = {
  inspect: (evidence: Evidence) => void;
};

const EvidenceInspectorContext = React.createContext<InspectorValue | null>(
  null,
);

export function useEvidenceInspector(): InspectorValue | null {
  return React.useContext(EvidenceInspectorContext);
}

export function EvidenceInspectorProvider({
  sourceDocuments,
  children,
}: {
  sourceDocuments: SourceDocument[];
  children: React.ReactNode;
}) {
  const [active, setActive] = React.useState<Evidence | null>(null);
  const [open, setOpen] = React.useState(false);

  const sourceById = React.useMemo(
    () => new Map(sourceDocuments.map((d) => [d._id, d])),
    [sourceDocuments],
  );

  const value = React.useMemo<InspectorValue>(
    () => ({
      inspect: (evidence) => {
        setActive(evidence);
        setOpen(true);
      },
    }),
    [],
  );

  const source = active ? sourceById.get(active.sourceDocumentId) : undefined;

  return (
    <EvidenceInspectorContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" />
              Source evidence
            </DialogTitle>
            <DialogDescription>
              Every claim links to a source document. Public evidence proves a
              company is present — never that a named person will attend.
            </DialogDescription>
          </DialogHeader>

          {active ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="capitalize">
                  {active.factType}
                </Badge>
                <span className="text-muted-foreground">
                  confidence {Math.round(active.confidence * 100)}%
                </span>
                <a
                  href={active.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-auto inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                >
                  Open source
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium">
                  &ldquo;{active.quote}&rdquo;
                </p>
              </div>

              {source ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FileText className="size-3.5" />
                    {source.title ?? "Source document"}
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    <Highlighted text={source.textContent} term={active.quote} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </EvidenceInspectorContext.Provider>
  );
}

/** Highlights the best-matching span of the quote within the source text. */
function Highlighted({ text, term }: { text: string; term: string }) {
  const needle = pickNeedle(text, term);
  if (!needle) return <span>{text}</span>;

  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return <span>{text}</span>;

  return (
    <span>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/30 px-0.5 text-foreground">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </span>
  );
}

function pickNeedle(text: string, term: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes(term.toLowerCase())) return term;
  // Fall back to the longest token (likely the company name) found in source.
  const tokens = term
    .split(/[—\-·,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3)
    .sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    if (lower.includes(token.toLowerCase())) return token;
  }
  return null;
}
