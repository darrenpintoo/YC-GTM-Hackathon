import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  DEMO_CRM_CSV,
  DEMO_EVENT,
  DEMO_EXHIBITOR_SNAPSHOT,
} from "./lib/demoSeed";
import { resolveEventSourceText } from "./lib/fetchSource";
import { slugify } from "./lib/slugify";

type PipelineResult = {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
};

type RunIntroResult = PipelineResult & {
  profileId: Id<"revenueProfile">;
  eventId: Id<"event">;
  sourceDocumentId: Id<"sourceDocument">;
  slug: string;
};

const runIntentArgs = {
  objective: v.optional(v.string()),
  participationOptions: v.optional(v.array(v.string())),
  repCount: v.optional(v.number()),
};

const runResultValidator = v.object({
  profileId: v.id("revenueProfile"),
  eventId: v.id("event"),
  sourceDocumentId: v.id("sourceDocument"),
  slug: v.string(),
  matchCount: v.number(),
  eventScoreId: v.id("eventScore"),
  decisionMemoId: v.id("decisionMemo"),
});

export const runCorePipeline = action({
  args: {
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
    runIntent: v.optional(
      v.object({
        objective: v.optional(v.string()),
        participationOptions: v.optional(v.array(v.string())),
        repCount: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({
    matchCount: v.number(),
    eventScoreId: v.id("eventScore"),
    decisionMemoId: v.id("decisionMemo"),
  }),
  handler: async (ctx, args): Promise<PipelineResult> => {
    return await ctx.runAction(internal.pipeline.runPipelineInternal, args);
  },
});

/** Run the full pipeline from landing-page inputs (CSV + event source + intent). */
export const runFromIntro = action({
  args: {
    csvText: v.optional(v.string()),
    eventName: v.string(),
    eventSource: v.string(),
    sponsorQuote: v.optional(v.number()),
    profileName: v.optional(v.string()),
    ...runIntentArgs,
  },
  returns: runResultValidator,
  handler: async (ctx, args): Promise<RunIntroResult> => {
    return await executeIntroRun(ctx, {
      csvText: args.csvText?.trim() || DEMO_CRM_CSV,
      eventName: args.eventName.trim() || DEMO_EVENT.name,
      eventSource: args.eventSource.trim(),
      sponsorQuote: args.sponsorQuote ?? DEMO_EVENT.sponsorQuote,
      profileName: args.profileName?.trim() || DEMO_EVENT.profileName,
      objective: args.objective,
      participationOptions: args.participationOptions,
      repCount: args.repCount,
    });
  },
});

/** Back-compat: seed with baked-in demo fixtures (same pipeline path). */
export const seedDemo = action({
  args: {},
  returns: runResultValidator,
  handler: async (ctx): Promise<RunIntroResult> => {
    return await executeIntroRun(ctx, {
      csvText: DEMO_CRM_CSV,
      eventName: DEMO_EVENT.name,
      eventSource: DEMO_EXHIBITOR_SNAPSHOT,
      sponsorQuote: DEMO_EVENT.sponsorQuote,
      profileName: DEMO_EVENT.profileName,
    });
  },
});

type IntroRunArgs = {
  csvText: string;
  eventName: string;
  eventSource: string;
  sponsorQuote: number;
  profileName: string;
  objective?: string;
  participationOptions?: string[];
  repCount?: number;
};

async function executeIntroRun(
  ctx: ActionCtx,
  args: IntroRunArgs,
): Promise<RunIntroResult> {
  const slug = slugify(args.eventName);

  const profileId: Id<"revenueProfile"> = await ctx.runMutation(
    api.profile.buildFromCsv,
    {
      csvText: args.csvText,
      profileName: args.profileName,
    },
  );

  const eventId: Id<"event"> = await ctx.runMutation(api.events.create, {
    name: args.eventName,
    slug,
    startDate: DEMO_EVENT.startDate,
    endDate: DEMO_EVENT.endDate,
    location: DEMO_EVENT.location,
    sponsorQuote: args.sponsorQuote,
    revenueProfileId: profileId,
  });

  const source = await resolveEventSourceText(args.eventSource);

  const sourceDocumentId: Id<"sourceDocument"> = await ctx.runMutation(
    api.ingest.ingestSource,
    {
      eventId,
      textContent: source.text,
      kind: source.kind,
      url: source.url ?? (source.kind === "url" ? args.eventSource : undefined),
      title: `${args.eventName} — event source`,
    },
  );

  const hasIntent =
    args.objective ||
    (args.participationOptions && args.participationOptions.length > 0) ||
    args.repCount != null;

  const pipeline: PipelineResult = await ctx.runAction(
    internal.pipeline.runPipelineInternal,
    {
      eventId,
      sourceDocumentId,
      runIntent: hasIntent
        ? {
            objective: args.objective,
            participationOptions: args.participationOptions,
            repCount: args.repCount,
          }
        : undefined,
    },
  );

  return {
    profileId,
    eventId,
    sourceDocumentId,
    slug,
    ...pipeline,
  };
}
