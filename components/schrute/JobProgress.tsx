"use client";

import { Check, CircleDashed, Loader2, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { CORE_JOB_STEPS, SIDECAR_JOB_STEPS } from "@/lib/types";
import type { Job, JobStatus, JobStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<JobStep, string> = {
  ingest: "Gather sources",
  extract: "Extract companies",
  match: "Match accounts",
  score: "Underwrite + score",
  memo: "Draft memo",
  enrich: "Find attendees + contacts",
  outreach: "Draft outreach",
};

type JobProgressProps = {
  jobs: Job[];
  className?: string;
};

export function JobProgress({ jobs, className }: JobProgressProps) {
  const byStep = new Map(jobs.map((j) => [j.step, j]));

  const completed = jobs.filter((j) => j.status === "completed").length;
  const total = jobs.length || CORE_JOB_STEPS.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Pipeline</span>
          <span className="tabular-nums">
            {completed}/{total} steps
          </span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="space-y-1">
        {CORE_JOB_STEPS.map((step) => (
          <StepRow key={step} step={step} job={byStep.get(step)} />
        ))}
      </div>

      <div className="space-y-1 border-t border-border pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Enrichment sidecar (non-blocking)
        </p>
        {SIDECAR_JOB_STEPS.map((step) => (
          <StepRow key={step} step={step} job={byStep.get(step)} sidecar />
        ))}
      </div>
    </div>
  );
}

function StepRow({
  step,
  job,
  sidecar,
}: {
  step: JobStep;
  job?: Job;
  sidecar?: boolean;
}) {
  const status: JobStatus = job?.status ?? "pending";

  return (
    <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm",
              status === "completed"
                ? "text-foreground"
                : status === "running"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {STEP_LABEL[step]}
          </span>
          {job?.progress != null && status === "running" ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {job.progress}%
            </span>
          ) : null}
        </div>
        {job?.message ? (
          <p className="truncate text-xs text-muted-foreground">
            {job.message}
          </p>
        ) : null}
        {job?.error ? (
          <p className="truncate text-xs text-destructive">{job.error}</p>
        ) : null}
      </div>
      {sidecar && status === "pending" ? (
        <span className="text-[10px] text-muted-foreground">queued</span>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex size-5 items-center justify-center rounded-full bg-success/20 text-success">
          <Check className="size-3" />
        </span>
      );
    case "running":
      return (
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Loader2 className="size-3 animate-spin" />
        </span>
      );
    case "failed":
      return (
        <span className="flex size-5 items-center justify-center rounded-full bg-destructive/20 text-destructive">
          <X className="size-3" />
        </span>
      );
    default:
      return (
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CircleDashed className="size-3" />
        </span>
      );
  }
}
