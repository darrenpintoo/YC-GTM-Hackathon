import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  DEMO_CRM_CSV,
  DEMO_EVENT,
  DEMO_EXHIBITOR_SNAPSHOT,
} from "./lib/demoSeed";

type PipelineResult = {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
};

type SeedDemoResult = PipelineResult & {
  profileId: Id<"revenueProfile">;
  eventId: Id<"event">;
  sourceDocumentId: Id<"sourceDocument">;
};

export const runCorePipeline = action({
  args: {
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
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

export const seedDemo = action({
  args: {},
  returns: v.object({
    profileId: v.id("revenueProfile"),
    eventId: v.id("event"),
    sourceDocumentId: v.id("sourceDocument"),
    matchCount: v.number(),
    eventScoreId: v.id("eventScore"),
    decisionMemoId: v.id("decisionMemo"),
  }),
  handler: async (ctx): Promise<SeedDemoResult> => {
    const profileId: Id<"revenueProfile"> = await ctx.runMutation(
      api.profile.buildFromCsv,
      {
        csvText: DEMO_CRM_CSV,
        profileName: DEMO_EVENT.profileName,
      },
    );

    const eventId: Id<"event"> = await ctx.runMutation(api.events.create, {
      name: DEMO_EVENT.name,
      slug: DEMO_EVENT.slug,
      startDate: DEMO_EVENT.startDate,
      endDate: DEMO_EVENT.endDate,
      location: DEMO_EVENT.location,
      sponsorQuote: DEMO_EVENT.sponsorQuote,
      revenueProfileId: profileId,
    });

    const sourceDocumentId: Id<"sourceDocument"> = await ctx.runMutation(
      api.ingest.ingestSource,
      {
        eventId,
        textContent: DEMO_EXHIBITOR_SNAPSHOT,
        kind: "snapshot",
        url: "https://www.worldofconcrete.com/en/exhibitor-list.html",
        title: "World of Concrete 2026 Exhibitor List (cached snapshot)",
      },
    );

    const pipeline: PipelineResult = await ctx.runAction(
      internal.pipeline.runPipelineInternal,
      { eventId, sourceDocumentId },
    );

    return {
      profileId,
      eventId,
      sourceDocumentId,
      ...pipeline,
    };
  },
});
