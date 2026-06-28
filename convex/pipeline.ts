import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type PipelineResult = {
  matchCount: number;
  eventScoreId: Id<"eventScore">;
  decisionMemoId: Id<"decisionMemo">;
};

export const runPipelineInternal = internalAction({
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
    await ctx.runMutation(internal.ingest.extractFromSource, {
      eventId: args.eventId,
      sourceDocumentId: args.sourceDocumentId,
    });

    const matchCount: number = await ctx.runMutation(internal.matcher.run, {
      eventId: args.eventId,
    });

    const eventScoreId: Id<"eventScore"> = await ctx.runMutation(
      internal.underwrite.scoreEvent,
      { eventId: args.eventId },
    );

    const decisionMemoId: Id<"decisionMemo"> = await ctx.runMutation(
      internal.memo.generate,
      { eventId: args.eventId },
    );

    return { matchCount, eventScoreId, decisionMemoId };
  },
});
