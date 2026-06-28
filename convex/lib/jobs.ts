import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
type JobStep =
  | "ingest"
  | "extract"
  | "match"
  | "score"
  | "memo"
  | "enrich"
  | "outreach";

type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export async function upsertJob(
  ctx: MutationCtx,
  eventId: Id<"event">,
  step: JobStep,
  patch: {
    status: JobStatus;
    message?: string;
    progress?: number;
    error?: string;
  },
): Promise<Id<"jobs">> {
  const now = Date.now();
  const existing = await ctx.db
    .query("jobs")
    .withIndex("by_event_and_step", (q) => q.eq("eventId", eventId).eq("step", step))
    .first();

  const base = {
    eventId,
    step,
    status: patch.status,
    message: patch.message,
    progress: patch.progress,
    error: patch.error,
    updatedAt: now,
    ...(patch.status === "running" ? { startedAt: now } : {}),
    ...(patch.status === "completed" || patch.status === "failed"
      ? { completedAt: now }
      : {}),
  };

  if (existing) {
    await ctx.db.patch("jobs", existing._id, base);
    return existing._id;
  }

  return await ctx.db.insert("jobs", base);
}

export async function initCoreJobs(
  ctx: MutationCtx,
  eventId: Id<"event">,
): Promise<void> {
  const steps: JobStep[] = ["ingest", "extract", "match", "score", "memo"];
  for (const step of steps) {
    await upsertJob(ctx, eventId, step, {
      status: "pending",
      progress: 0,
    });
  }
}
