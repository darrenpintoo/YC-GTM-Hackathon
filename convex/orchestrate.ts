import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  DEMO_CRM_CSV,
  DEMO_EVENT,
  DEMO_EXHIBITOR_SNAPSHOT,
} from "./lib/demoSeed";
import { slugify } from "./lib/slugify";

const runIntentArgs = {
  objective: v.optional(v.string()),
  participationOptions: v.optional(v.array(v.string())),
  repCount: v.optional(v.number()),
};

type RunIntent = {
  objective?: string;
  participationOptions?: string[];
  repCount?: number;
};

type PreparedEvent = {
  profileId: Id<"revenueProfile">;
  eventId: Id<"event">;
  slug: string;
};

type PipelineFullResult = {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
  sourceCount: number;
};

type FullRunResult = PreparedEvent & {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
  sourceCount: number;
};

const startResultValidator = v.object({
  profileId: v.id("revenueProfile"),
  eventId: v.id("event"),
  slug: v.string(),
});

const fullResultValidator = v.object({
  profileId: v.id("revenueProfile"),
  eventId: v.id("event"),
  sourceCount: v.number(),
  slug: v.string(),
  matchCount: v.number(),
  eventScoreId: v.id("eventScore"),
  decisionMemoId: v.id("decisionMemo"),
});

const introArgs = {
  csvText: v.optional(v.string()),
  eventName: v.string(),
  eventSource: v.string(),
  sponsorQuote: v.optional(v.number()),
  profileName: v.optional(v.string()),
  ...runIntentArgs,
};

/**
 * Streaming entry point for the live UI: create the profile + event fast,
 * return the slug immediately, and run the heavy pipeline in the background so
 * the client can watch job rows stream in via `listJobsByEvent`.
 */
export const startRun = action({
  args: introArgs,
  returns: startResultValidator,
  handler: async (ctx, args): Promise<PreparedEvent> => {
    const prepared = await prepareEvent(ctx, args);

    await ctx.scheduler.runAfter(0, internal.pipeline.runFullPipeline, {
      eventId: prepared.eventId,
      eventName: args.eventName.trim() || DEMO_EVENT.name,
      eventSource: args.eventSource.trim(),
      runIntent: buildIntent(args),
    });

    return prepared;
  },
});

/** Synchronous run (back-compat): awaits the full pipeline before returning. */
export const runFromIntro = action({
  args: introArgs,
  returns: fullResultValidator,
  handler: async (ctx, args): Promise<FullRunResult> => {
    const prepared = await prepareEvent(ctx, args);

    const pipeline: PipelineFullResult = await ctx.runAction(
      internal.pipeline.runFullPipeline,
      {
        eventId: prepared.eventId,
        eventName: args.eventName.trim() || DEMO_EVENT.name,
        eventSource: args.eventSource.trim(),
        runIntent: buildIntent(args),
      },
    );

    return {
      ...prepared,
      matchCount: pipeline.matchCount,
      eventScoreId: pipeline.eventScoreId,
      decisionMemoId: pipeline.decisionMemoId,
      sourceCount: pipeline.sourceCount,
    };
  },
});

/** Back-compat: seed with baked-in demo fixtures (same pipeline path). */
export const seedDemo = action({
  args: {},
  returns: fullResultValidator,
  handler: async (ctx): Promise<FullRunResult> => {
    const prepared = await prepareEvent(ctx, {
      csvText: DEMO_CRM_CSV,
      eventName: DEMO_EVENT.name,
      sponsorQuote: DEMO_EVENT.sponsorQuote,
      profileName: DEMO_EVENT.profileName,
      startDate: DEMO_EVENT.startDate,
      endDate: DEMO_EVENT.endDate,
      location: DEMO_EVENT.location,
    });

    const pipeline: PipelineFullResult = await ctx.runAction(
      internal.pipeline.runFullPipeline,
      {
        eventId: prepared.eventId,
        eventName: DEMO_EVENT.name,
        eventSource: DEMO_EXHIBITOR_SNAPSHOT,
        runIntent: undefined,
      },
    );

    return {
      ...prepared,
      matchCount: pipeline.matchCount,
      eventScoreId: pipeline.eventScoreId,
      decisionMemoId: pipeline.decisionMemoId,
      sourceCount: pipeline.sourceCount,
    };
  },
});

async function prepareEvent(
  ctx: ActionCtx,
  args: {
    csvText?: string;
    eventName: string;
    sponsorQuote?: number;
    profileName?: string;
    // Live runs leave these undefined — research.gather discovers the real
    // dates/location. seedDemo passes the baked-in demo values.
    startDate?: string;
    endDate?: string;
    location?: string;
  },
): Promise<PreparedEvent> {
  const eventName = args.eventName.trim() || DEMO_EVENT.name;
  const slug = slugify(eventName);

  const profileId: Id<"revenueProfile"> = await ctx.runMutation(
    api.profile.buildFromCsv,
    {
      csvText: args.csvText?.trim() || DEMO_CRM_CSV,
      profileName: args.profileName?.trim() || DEMO_EVENT.profileName,
    },
  );

  const eventId: Id<"event"> = await ctx.runMutation(api.events.create, {
    name: eventName,
    slug,
    startDate: args.startDate,
    endDate: args.endDate,
    location: args.location,
    sponsorQuote: args.sponsorQuote ?? DEMO_EVENT.sponsorQuote,
    revenueProfileId: profileId,
  });

  return { profileId, eventId, slug };
}

function buildIntent(args: RunIntent): RunIntent | undefined {
  const hasIntent =
    args.objective ||
    (args.participationOptions && args.participationOptions.length > 0) ||
    args.repCount != null;

  return hasIntent
    ? {
        objective: args.objective,
        participationOptions: args.participationOptions,
        repCount: args.repCount,
      }
    : undefined;
}
