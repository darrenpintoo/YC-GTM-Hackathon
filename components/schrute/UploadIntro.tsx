"use client";

import * as React from "react";
import {
  CalendarDays,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type IntroPayload = {
  csvText?: string;
  csvFileName?: string;
  companyCount: number;
  eventName: string;
  eventSource: string;
  sponsorQuote: number;
};

const DEMO_PAYLOAD: IntroPayload = {
  csvFileName: "safesite_crm.csv",
  companyCount: 10,
  eventName: "World of Concrete 2026",
  eventSource: "https://www.worldofconcrete.com/en/exhibitor-list.html",
  sponsorQuote: 25000,
};

type UploadIntroProps = {
  running?: boolean;
  onRun: (payload: IntroPayload) => void;
};

export function UploadIntro({ running, onRun }: UploadIntroProps) {
  const [csvText, setCsvText] = React.useState<string | undefined>();
  const [csvFileName, setCsvFileName] = React.useState<string | undefined>();
  const [companyCount, setCompanyCount] = React.useState(0);
  const [companyPreview, setCompanyPreview] = React.useState<string[]>([]);
  const [eventName, setEventName] = React.useState("");
  const [eventSource, setEventSource] = React.useState("");
  const [sponsorQuote, setSponsorQuote] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  function ingestCsv(text: string, fileName: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      toast.error("That CSV looks empty");
      return;
    }
    const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = Math.max(
      0,
      header.findIndex((h) => h === "company_name" || h === "company"),
    );
    const rows = lines.slice(1);
    setCsvText(text);
    setCsvFileName(fileName);
    setCompanyCount(rows.length);
    setCompanyPreview(
      rows.slice(0, 4).map((r) => r.split(",")[nameIdx]?.trim() ?? "—"),
    );
    toast.success(`${rows.length} accounts parsed from ${fileName}`);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    ingestCsv(text, file.name);
  }

  function loadDemo() {
    setCsvFileName(DEMO_PAYLOAD.csvFileName);
    setCompanyCount(DEMO_PAYLOAD.companyCount);
    setCompanyPreview([
      "Turner Construction",
      "Skanska USA",
      "Clark Construction",
      "Mortenson",
    ]);
    setEventName(DEMO_PAYLOAD.eventName);
    setEventSource(DEMO_PAYLOAD.eventSource);
    setSponsorQuote(String(DEMO_PAYLOAD.sponsorQuote));
    setCsvText(undefined);
  }

  const ready = companyCount > 0 && eventName.trim() && eventSource.trim();

  function handleRun() {
    onRun({
      csvText,
      csvFileName,
      companyCount,
      eventName: eventName.trim(),
      eventSource: eventSource.trim(),
      sponsorQuote: Number(sponsorQuote) || 0,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          See the pipeline that&apos;s already going.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Connect your CRM and drop in an event. Schrute finds which of your{" "}
          <span className="text-foreground">target accounts are confirmed present</span>
          , scores the sponsor/attend/skip call, and turns matches into outreach.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-primary" />
            1 · Your CRM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40",
            )}
          >
            <Upload className="mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drop a CRM CSV or click to browse
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              company_name, account_type, deal_size, open_opp_value…
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>

          {companyCount > 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {csvFileName ?? "CRM data"}
                </span>
                <span className="text-muted-foreground">
                  {companyCount} accounts
                </span>
              </div>
              {companyPreview.length > 0 ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {companyPreview.join(" · ")}
                  {companyCount > companyPreview.length ? " …" : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            2 · The event
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Event name</FieldLabel>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="World of Concrete 2026"
              />
            </div>
            <div>
              <FieldLabel>Sponsor quote ($)</FieldLabel>
              <Input
                value={sponsorQuote}
                onChange={(e) => setSponsorQuote(e.target.value)}
                placeholder="25000"
                inputMode="numeric"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Exhibitor / sponsor list URL</FieldLabel>
            <Input
              value={eventSource}
              onChange={(e) => setEventSource(e.target.value)}
              placeholder="https://…/exhibitor-list"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!ready || running}
          onClick={handleRun}
        >
          {running ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Running Schrute…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Run Schrute
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={loadDemo}
          disabled={running}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          or load the demo (SafeSite OS × World of Concrete)
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}
