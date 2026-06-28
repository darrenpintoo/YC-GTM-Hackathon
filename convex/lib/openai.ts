import { eventExtractionSchema, revenueProfileSchema } from "../../lib/aiSchemas";

type JsonSchema = {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

export async function callOpenAiJson<T>(args: {
  system: string;
  user: string;
  responseSchema: JsonSchema;
}): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: args.responseSchema,
      },
    }),
  });

  if (!response.ok) {
    console.error("OpenAI error", await response.text());
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  return JSON.parse(content) as T;
}

/**
 * Call the Responses API with the hosted `web_search` tool so the model can
 * actually look up live public information (posts, articles, event pages) and
 * return it as structured JSON. Returns null when the key is missing or the
 * call/parse fails, so callers fall back gracefully.
 */
export async function callOpenAiWebSearch<T>(args: {
  instructions: string;
  input: string;
  responseSchema: JsonSchema;
  model?: string;
}): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model ?? "gpt-4o",
        instructions: args.instructions,
        input: args.input,
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
        text: {
          format: {
            type: "json_schema",
            name: args.responseSchema.name,
            strict: false,
            schema: args.responseSchema.schema,
          },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      console.error("OpenAI web search error", await response.text());
      return null;
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    const text = extractResponseText(payload);
    if (!text) return null;

    const json = parseFirstJsonObject(text);
    return json as T | null;
  } catch (err) {
    console.error("OpenAI web search failed", err);
    return null;
  }
}

function extractResponseText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}): string | null {
  if (payload.output_text && payload.output_text.trim()) {
    return payload.output_text;
  }
  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.text && part.text.trim()) return part.text;
    }
  }
  return null;
}

function parseFirstJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export { eventExtractionSchema, revenueProfileSchema };
