/**
 * Objective-driven onboarding + participation underwriting (frontend).
 *
 * The landing wizard asks WHY the user is evaluating an event, and WHAT forms
 * of participation they're weighing (sponsor / reps / speaker / side event).
 * Those choices tailor the questions we ask and the "is it worth it?" verdict.
 */

export type ObjectiveKey =
  | "spend_decision"
  | "prospect_list"
  | "meet_people"
  | "portfolio";

export type ParticipationKey = "attend" | "sponsor" | "speak" | "exhibit";

export type AdaptiveQuestion = {
  field: string;
  label: string;
  placeholder: string;
  inputMode?: "numeric" | "text";
};

export type ObjectiveDef = {
  key: ObjectiveKey;
  title: string;
  blurb: string;
  /** One focused follow-up question tailored to the objective. */
  question: AdaptiveQuestion;
};

export const OBJECTIVES: ObjectiveDef[] = [
  {
    key: "spend_decision",
    title: "Decide how to show up",
    blurb: "Attend, sponsor, speak, exhibit — or skip. Know how hard to go in.",
    question: {
      field: "repCount",
      label: "How many reps on the ground?",
      placeholder: "2",
      inputMode: "numeric",
    },
  },
  {
    key: "prospect_list",
    title: "Build a pre-qualified prospect list",
    blurb: "Turn the floor into net-new ICP accounts worth working.",
    question: {
      field: "targetNewAccounts",
      label: "How many net-new accounts is a win?",
      placeholder: "10",
      inputMode: "numeric",
    },
  },
  {
    key: "meet_people",
    title: "Find people to meet at the show",
    blurb: "Who from your pipeline is posting about going — and who to book.",
    question: {
      field: "targetMeetings",
      label: "How many booked meetings = success?",
      placeholder: "6",
      inputMode: "numeric",
    },
  },
  {
    key: "portfolio",
    title: "Plan which events are worth it",
    blurb: "See where your pipeline clusters across your event calendar.",
    question: {
      field: "regionFocus",
      label: "Priority region (optional)",
      placeholder: "US West",
      inputMode: "text",
    },
  },
];

export type ParticipationDef = {
  key: ParticipationKey;
  title: string;
  blurb: string;
};

export const PARTICIPATION: ParticipationDef[] = [
  { key: "attend", title: "Attend", blurb: "Send reps with badges" },
  { key: "sponsor", title: "Sponsor", blurb: "Sponsorship package" },
  { key: "speak", title: "Speak", blurb: "Apply for a session" },
  { key: "exhibit", title: "Exhibit", blurb: "Booth on the floor" },
];

export type ParticipationStatus = "yes" | "maybe" | "no";

export type ParticipationContext = {
  sponsorQuote?: number;
  sponsorCap: number;
  accountsPresent: number;
  openOppCount: number;
  icpDensity: number;
  repCount?: number;
};

export type ParticipationVerdictResult = {
  status: ParticipationStatus;
  headline: string;
  reason: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(n);
}

export function evaluateParticipation(
  key: ParticipationKey,
  ctx: ParticipationContext,
): ParticipationVerdictResult {
  switch (key) {
    case "attend": {
      if (ctx.accountsPresent > 0) {
        if (ctx.repCount === 0) {
          return {
            status: "no",
            headline: "No reps",
            reason: `${ctx.accountsPresent} accounts are on the floor, but zero reps means you miss them live. Pre-book virtual meetings or send at least one.`,
          };
        }
        if (ctx.repCount === undefined) {
          return {
            status: "maybe",
            headline: "Assumes 2",
            reason: `${ctx.accountsPresent} of your accounts are on the floor. Headcount is not set, so Schrute is using a 2-rep planning assumption.`,
          };
        }
        const reps = ctx.repCount > 0 ? ctx.repCount : 2;
        return {
          status: "yes",
          headline: "Do this",
          reason: `${ctx.accountsPresent} of your accounts are on the floor. Send ${reps} rep${reps === 1 ? "" : "s"} with badges to work them.`,
        };
      }
      return {
        status: "maybe",
        headline: "Thin",
        reason: "Few matched accounts here — reps may have little to work.",
      };
    }
    case "exhibit": {
      if (!ctx.sponsorQuote) {
        return {
          status: "maybe",
          headline: "Add a quote",
          reason: "Enter the booth quote to test it against your cap.",
        };
      }
      if (ctx.sponsorQuote <= ctx.sponsorCap) {
        return {
          status: "yes",
          headline: "Worth it",
          reason: `${fmt(ctx.sponsorQuote)} booth sits under your ${fmt(
            ctx.sponsorCap,
          )} cap for this floor.`,
        };
      }
      return {
        status: "no",
        headline: "Over cap",
        reason: `${fmt(ctx.sponsorQuote)} booth exceeds your ${fmt(
          ctx.sponsorCap,
        )} cap — your accounts are here whether you exhibit or not. Attend instead.`,
      };
    }
    case "sponsor": {
      if (ctx.icpDensity >= 0.7 && ctx.sponsorQuote && ctx.sponsorQuote <= ctx.sponsorCap) {
        return {
          status: "maybe",
          headline: "Only for lift",
          reason: "High ICP density makes brand lift defensible — but presence alone doesn't need it.",
        };
      }
      return {
        status: "no",
        headline: "Skip",
        reason: "Sponsorship rarely changes who shows up. Put the spend into reps and meetings.",
      };
    }
    case "speak": {
      if (ctx.icpDensity >= 0.6) {
        return {
          status: "yes",
          headline: "Strong fit",
          reason: "High ICP density in the room — a session puts you in front of buyers.",
        };
      }
      return {
        status: "maybe",
        headline: "Depends",
        reason: "Worth it only if the session audience matches your ICP.",
      };
    }
  }
}
