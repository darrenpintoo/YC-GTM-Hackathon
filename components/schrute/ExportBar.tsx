"use client";

import { Download, FileJson } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ROLE_LABEL, TIER_META } from "@/lib/labels";
import type {
  AccountMatch,
  Contact,
  Event,
  OutreachDraft,
} from "@/lib/types";

type ExportBarProps = {
  event: Event;
  matches: AccountMatch[];
  contacts: Contact[];
  outreachDrafts: OutreachDraft[];
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportBar({
  event,
  matches,
  contacts,
  outreachDrafts,
}: ExportBarProps) {
  const contactByMatch = new Map(contacts.map((c) => [c.accountMatchId, c]));
  const draftByMatch = new Map(outreachDrafts.map((d) => [d.accountMatchId, d]));

  function buildRows() {
    return matches.map((m) => {
      const c = contactByMatch.get(m._id);
      const d = draftByMatch.get(m._id);
      return {
        company: m.companyName,
        tier: TIER_META[m.tier].short,
        role: ROLE_LABEL[m.role],
        booth: m.boothOrSession ?? "",
        fit: Math.round(m.fitScore * 100) + "%",
        confidence: Math.round(m.confidence * 100) + "%",
        open_opp_value: m.matchedOppValue ?? "",
        contact: c?.fullName ?? "",
        title: c?.title ?? "",
        email: c?.email ?? "",
        verification: c?.verification ?? "",
        outreach_subject: d?.subject ?? "",
      };
    });
  }

  function exportCsv() {
    const rows = buildRows();
    if (rows.length === 0) {
      toast.error("Nothing to export yet");
      return;
    }
    const headers = Object.keys(rows[0]!);
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => csvCell((r as Record<string, string | number>)[h])).join(","),
      ),
    ];
    download(
      `schrute-worklist-${slugify(event.name)}.csv`,
      lines.join("\n"),
      "text/csv",
    );
    toast.success(`Exported ${rows.length} accounts to CSV`);
  }

  function exportJson() {
    const payload = {
      event: { name: event.name, slug: event.slug },
      generatedAt: new Date().toISOString(),
      worklist: buildRows(),
    };
    download(
      `schrute-worklist-${slugify(event.name)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    toast.success("Exported worklist as JSON");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-sm">
        <span className="font-medium">{matches.length} accounts</span>{" "}
        <span className="text-muted-foreground">
          ready as a pre-event worklist
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={exportJson}>
          <FileJson className="size-4" />
          JSON
        </Button>
      </div>
    </div>
  );
}
