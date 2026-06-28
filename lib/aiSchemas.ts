/**
 * OpenAI structured-output schemas for Schrute AI calls.
 * Hard rule: missing facts → "unknown", never invented.
 * Never emit personal-attendance claims — company presence only.
 */

export const OPENAI_STRUCTURED_OUTPUT_RULES = {
  missingFactValue: "unknown",
  neverClaimPersonalAttendance: true,
  companyPresenceOnly: true,
} as const;

/** Revenue Profile clustering from CRM CSV rows. */
export const revenueProfileSchema = {
  name: "revenue_profile",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "industries",
      "buyerTitles",
      "dealSizeClusters",
      "geographies",
      "keywords",
      "closedWonPatterns",
      "summary",
    ],
    properties: {
      industries: {
        type: "array",
        items: { type: "string" },
        description: "Industries where closed-won deals cluster.",
      },
      buyerTitles: {
        type: "array",
        items: { type: "string" },
        description: "Decision-maker titles seen in wins and open opps.",
      },
      dealSizeClusters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "min", "max", "count"],
          properties: {
            label: { type: "string" },
            min: { type: "number" },
            max: { type: "number" },
            count: { type: "number" },
          },
        },
      },
      geographies: { type: "array", items: { type: "string" } },
      keywords: { type: "array", items: { type: "string" } },
      closedWonPatterns: {
        type: "array",
        items: { type: "string" },
        description: "Short patterns describing who you win with.",
      },
      summary: {
        type: "string",
        description: "One paragraph ICP summary grounded in CRM data.",
      },
    },
  },
} as const;

/** Extract companies and facts from a source document (exhibitor/sponsor/speaker lists). */
export const eventExtractionSchema = {
  name: "event_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["companies", "facts", "extractionNotes"],
    properties: {
      companies: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["companyName", "role", "boothOrSession", "quote", "confidence"],
          properties: {
            companyName: { type: "string" },
            role: {
              type: "string",
              enum: ["exhibitor", "sponsor", "speaker", "unknown"],
            },
            boothOrSession: {
              type: "string",
              description: "Booth number or session title; use 'unknown' if not in source.",
            },
            quote: {
              type: "string",
              description: "Verbatim snippet from source proving company presence.",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
          },
        },
      },
      facts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["factType", "label", "value", "quote", "confidence"],
          properties: {
            factType: {
              type: "string",
              enum: [
                "exhibitor_list",
                "sponsor_list",
                "speaker_list",
                "agenda",
                "booth_map",
                "other",
                "unknown",
              ],
            },
            label: { type: "string" },
            value: { type: "string" },
            quote: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      extractionNotes: {
        type: "array",
        items: { type: "string" },
        description: "Gaps, ambiguities, or missing data — do not fill with guesses.",
      },
    },
  },
} as const;

/** Citation-constrained Go/No-Go memo in Schrute voice. */
export const decisionMemoSchema = {
  name: "decision_memo",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "headline",
      "verdict",
      "sections",
      "missingEvidence",
      "objectionsAddressed",
    ],
    properties: {
      headline: { type: "string" },
      verdict: {
        type: "string",
        enum: ["sponsor", "attend", "side_event", "ask_for_data", "skip"],
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "body", "citationQuotes"],
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            citationQuotes: {
              type: "array",
              items: { type: "string" },
              description:
                "Exact quotes from provided sources or match evidence only.",
            },
          },
        },
      },
      missingEvidence: {
        type: "array",
        items: { type: "string" },
        description: "What we still need — 'ask_for_data' is valid.",
      },
      objectionsAddressed: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const;

/** Outreach draft — references event + account context, not personal attendance. */
export const outreachDraftSchema = {
  name: "outreach_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["subject", "body", "tone"],
    properties: {
      subject: { type: "string" },
      body: {
        type: "string",
        description:
          "Pre-event meeting request. Reference confirmed company presence at event, never claim contact will attend.",
      },
      tone: { type: "string" },
    },
  },
} as const;

export type RevenueProfileOutput = {
  industries: string[];
  buyerTitles: string[];
  dealSizeClusters: Array<{
    label: string;
    min: number;
    max: number;
    count: number;
  }>;
  geographies: string[];
  keywords: string[];
  closedWonPatterns: string[];
  summary: string;
};

export type EventExtractionCompany = {
  companyName: string;
  role: "exhibitor" | "sponsor" | "speaker" | "unknown";
  boothOrSession: string;
  quote: string;
  confidence: number;
};

export type EventExtractionFact = {
  factType:
    | "exhibitor_list"
    | "sponsor_list"
    | "speaker_list"
    | "agenda"
    | "booth_map"
    | "other"
    | "unknown";
  label: string;
  value: string;
  quote: string;
  confidence: number;
};

export type EventExtractionOutput = {
  companies: EventExtractionCompany[];
  facts: EventExtractionFact[];
  extractionNotes: string[];
};

export type DecisionMemoOutput = {
  headline: string;
  verdict:
    | "sponsor"
    | "attend"
    | "side_event"
    | "ask_for_data"
    | "skip";
  sections: Array<{
    title: string;
    body: string;
    citationQuotes: string[];
  }>;
  missingEvidence: string[];
  objectionsAddressed: string[];
};

export type OutreachDraftOutput = {
  subject: string;
  body: string;
  tone: string;
};

/** Prompt guardrails shared across AI calls. */
export const AI_GUARDRAILS = `
You extract and summarize ONLY from provided source text.
- If a fact is not explicitly in the source, return "unknown" — never invent.
- You may confirm COMPANY presence (exhibitor/sponsor/speaker) with a quote.
- You must NEVER claim a named person will attend an event.
- Separate fit (ICP relevance) from confidence (source quality).
`.trim();
