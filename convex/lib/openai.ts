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

export { eventExtractionSchema, revenueProfileSchema };
