"use client";

import * as React from "react";
import {
  CalendarRange,
  Check,
  ListChecks,
  Loader2,
  Megaphone,
  Mic,
  Scale,
  Sparkles,
  Store,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OBJECTIVES,
  PARTICIPATION,
  type ObjectiveKey,
  type ParticipationKey,
} from "@/lib/objectives";
import { cn } from "@/lib/utils";

export type IntroPayload = {
  csvText?: string;
  csvFileName?: string;
  companyCount: number;
  eventName: string;
  eventSource: string;
  sponsorQuote: number;
  objective: ObjectiveKey | null;
  options: ParticipationKey[];
  repCount?: number;
  adaptiveAnswers: Record<string, string>;
};

const OBJECTIVE_ICONS: Record<ObjectiveKey, React.ReactNode> = {
  spend_decision: <Scale className="size-4" />,
  prospect_list: <ListChecks className="size-4" />,
  meet_people: <Users className="size-4" />,
  portfolio: <CalendarRange className="size-4" />,
};

const PARTICIPATION_ICONS: Record<ParticipationKey, React.ReactNode> = {
  attend: <Users className="size-3.5" />,
  sponsor: <Megaphone className="size-3.5" />,
  speak: <Mic className="size-3.5" />,
  exhibit: <Store className="size-3.5" />,
};

type UploadIntroProps = {
  running?: boolean;
  onRun: (payload: IntroPayload) => void;
  onWarmDemo?: () => void;
  warmDemoRunning?: boolean;
};

export function UploadIntro({
  running,
  onRun,
  onWarmDemo,
  warmDemoRunning,
}: UploadIntroProps) {
  const [csvText, setCsvText] = React.useState<string | undefined>();
  const [csvFileName, setCsvFileName] = React.useState<string | undefined>();
  const [companyCount, setCompanyCount] = React.useState(0);
  const [companyPreview, setCompanyPreview] = React.useState<string[]>([]);
  const [eventName, setEventName] = React.useState("");
  const [eventSource, setEventSource] = React.useState("");
  const [sponsorQuote, setSponsorQuote] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const [objective, setObjective] = React.useState<ObjectiveKey | null>("spend_decision");
  const [options, setOptions] = React.useState<Set<ParticipationKey>>(
    new Set(["attend", "exhibit"]),
  );
  const [adaptive, setAdaptive] = React.useState<Record<string, string>>({});

  const objectiveDef = OBJECTIVES.find((o) => o.key === objective) ?? null;

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
    setCsvFileName("safesite_crm.csv");
    setCompanyCount(10);
    setCompanyPreview([
      "Turner Construction",
      "Skanska USA",
      "Clark Construction",
      "Mortenson",
    ]);
    setEventName("World of Concrete 2026");
    setEventSource("https://www.worldofconcrete.com/en/exhibitor-list.html");
    setSponsorQuote("25000");
    setObjective("spend_decision");
    setOptions(new Set(["attend", "exhibit", "sponsor"]));
    setCsvText(undefined);
    toast.success("Demo loaded — SafeSite OS × World of Concrete");
  }

  function toggleOption(key: ParticipationKey) {
    setOptions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const ready = companyCount > 0 && eventName.trim() && eventSource.trim() && objective;

  function handleRun() {
    const repCount = adaptive.repCount ? Number(adaptive.repCount) : undefined;
    onRun({
      csvText,
      csvFileName,
      companyCount,
      eventName: eventName.trim(),
      eventSource: eventSource.trim(),
      sponsorQuote: Number(sponsorQuote) || 0,
      objective,
      options: [...options],
      repCount: Number.isFinite(repCount) ? repCount : undefined,
      adaptiveAnswers: adaptive,
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_1fr]">
        {/* Left — narrative + inputs */}
        <div>
          <p className="eyebrow text-success">Know before you commit</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl">
            Stop guessing which trade shows are{" "}
            <span className="italic text-muted-foreground">worth it.</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Your buyers aren&apos;t answering cold emails — but they&apos;re
            walking the floor at World of Concrete, CONEXPO, and NSC with budget
            in hand. Schrute matches your pipeline to who&apos;s actually there,
            then tells you whether to{" "}
            <span className="text-foreground">attend, sponsor, speak, or exhibit</span>{" "}
            — before you commit the spend.
          </p>

          <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">1.</span> Connect your CRM
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">2.</span> Match it against the event
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">3.</span> Get a go/no-go memo, not a spreadsheet
            </li>
          </ol>

          <div className="mt-7 space-y-4">
            <div>
              <FieldLabel>Your CRM</FieldLabel>
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
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-7 text-center transition-colors",
                  dragging
                    ? "border-success bg-success/5"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <Upload className="mb-2 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">Drop a CRM CSV or click to browse</p>
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
                <div className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{csvFileName ?? "CRM data"}</span>
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
            </div>

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
          </div>
        </div>

        {/* Right — objective + participation */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="eyebrow text-muted-foreground">What do you want Schrute to do?</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {OBJECTIVES.map((o) => {
              const active = objective === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setObjective(o.key)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-success/40 bg-success/5 ring-1 ring-success/30"
                      : "border-border bg-background/40 hover:border-foreground/20",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg",
                        active
                          ? "bg-success/15 text-success"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {OBJECTIVE_ICONS[o.key]}
                    </span>
                    {active ? <Check className="size-4 text-success" /> : null}
                  </div>
                  <span className="mt-1 text-sm font-semibold leading-snug">{o.title}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{o.blurb}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <p className="eyebrow text-muted-foreground">How would you show up?</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {PARTICIPATION.map((p) => {
                const active = options.has(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggleOption(p.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-foreground/20 bg-foreground text-background"
                        : "border-border bg-background/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    )}
                  >
                    {PARTICIPATION_ICONS[p.key]}
                    {p.title}
                  </button>
                );
              })}
            </div>
          </div>

          {objectiveDef ? (
            <div className="mt-5">
              <FieldLabel>{objectiveDef.question.label}</FieldLabel>
              <Input
                value={adaptive[objectiveDef.question.field] ?? ""}
                onChange={(e) =>
                  setAdaptive((prev) => ({
                    ...prev,
                    [objectiveDef.question.field]: e.target.value,
                  }))
                }
                placeholder={objectiveDef.question.placeholder}
                inputMode={objectiveDef.question.inputMode}
              />
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <Button
              size="lg"
              className="w-full"
              disabled={!ready || running || warmDemoRunning}
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
            {onWarmDemo ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={running || warmDemoRunning}
                onClick={onWarmDemo}
              >
                {warmDemoRunning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Running warmed ASSP demo…
                  </>
                ) : (
                  "Run warmed demo (ASSP Safety 2026)"
                )}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={loadDemo}
              disabled={running}
              className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            >
              or load the demo (SafeSite OS × World of Concrete)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}
