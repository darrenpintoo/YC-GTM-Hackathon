import { action, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  DEMO_CRM_CSV,
  DEMO_EVENT,
  DEMO_SOURCE_SNAPSHOT,
  DEMO_SOURCE_TITLE,
  DEMO_SOURCE_URL,
  SKIP_EVENT,
  SKIP_SOURCE_SNAPSHOT,
  SKIP_SOURCE_TITLE,
  SKIP_SOURCE_URL,
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

type ResetDemoResult = {
  deletedEvents: number;
  deletedProfiles: number;
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

export const resetDemo = mutation({
  args: {
    scope: v.optional(
      v.union(v.literal("all"), v.literal("main"), v.literal("skip")),
    ),
  },
  returns: v.object({
    deletedEvents: v.number(),
    deletedProfiles: v.number(),
  }),
  handler: async (ctx, args): Promise<ResetDemoResult> => {
    const scope = args.scope ?? "all";
    const eventSlugs =
      scope === "main"
        ? [DEMO_EVENT.slug, "world-of-concrete-2026"]
        : scope === "skip"
          ? [SKIP_EVENT.slug]
          : [DEMO_EVENT.slug, SKIP_EVENT.slug, "world-of-concrete-2026"];
    const profileNames =
      scope === "main"
        ? [DEMO_EVENT.profileName]
        : scope === "skip"
          ? [SKIP_EVENT.profileName]
          : [DEMO_EVENT.profileName, SKIP_EVENT.profileName];

    const profileIds = new Set<Id<"revenueProfile">>();
    let deletedEvents = 0;
    let deletedProfiles = 0;

    for (const slug of eventSlugs) {
      const events = await ctx.db
        .query("event")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .collect();

      for (const event of events) {
        if (event.revenueProfileId) profileIds.add(event.revenueProfileId);

        for (const row of await ctx.db
          .query("outreachDraft")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("contact")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("decisionMemo")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("eventScore")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("accountMatch")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("eventCompany")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("eventFact")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("sourceDocument")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }
        for (const row of await ctx.db
          .query("jobs")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()) {
          await ctx.db.delete(row._id);
        }

        await ctx.db.delete(event._id);
        deletedEvents += 1;
      }
    }

    const profiles = await ctx.db.query("revenueProfile").collect();
    for (const profile of profiles) {
      if (!profileIds.has(profile._id) && !profileNames.includes(profile.name)) {
        continue;
      }

      const accounts = await ctx.db
        .query("crmAccount")
        .withIndex("by_revenue_profile", (q) => q.eq("revenueProfileId", profile._id))
        .collect();
      for (const account of accounts) {
        await ctx.db.delete(account._id);
      }

      await ctx.db.delete(profile._id);
      deletedProfiles += 1;
    }

    return { deletedEvents, deletedProfiles };
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
    await ctx.runMutation(api.orchestrate.resetDemo, { scope: "main" });

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
        textContent: DEMO_SOURCE_SNAPSHOT,
        kind: "snapshot",
        url: DEMO_SOURCE_URL,
        title: DEMO_SOURCE_TITLE,
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

export const seedSkipDemo = action({
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
    await ctx.runMutation(api.orchestrate.resetDemo, { scope: "skip" });

    const profileId: Id<"revenueProfile"> = await ctx.runMutation(
      api.profile.buildFromCsv,
      {
        csvText: DEMO_CRM_CSV,
        profileName: SKIP_EVENT.profileName,
      },
    );

    const eventId: Id<"event"> = await ctx.runMutation(api.events.create, {
      name: SKIP_EVENT.name,
      slug: SKIP_EVENT.slug,
      startDate: SKIP_EVENT.startDate,
      endDate: SKIP_EVENT.endDate,
      location: SKIP_EVENT.location,
      sponsorQuote: SKIP_EVENT.sponsorQuote,
      revenueProfileId: profileId,
    });

    const sourceDocumentId: Id<"sourceDocument"> = await ctx.runMutation(
      api.ingest.ingestSource,
      {
        eventId,
        textContent: SKIP_SOURCE_SNAPSHOT,
        kind: "snapshot",
        url: SKIP_SOURCE_URL,
        title: SKIP_SOURCE_TITLE,
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
