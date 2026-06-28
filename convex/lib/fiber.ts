/**
 * Fiber AI integration — real contact enrichment.
 *
 * We feed the public LinkedIn URLs surfaced by web search into Fiber's
 * synchronous contact reveal to get verified work emails / phone numbers.
 * Missing key or any error returns null, so enrichment never breaks a run.
 */

import { withRedisCache } from "./redisCache";

const FIBER_BASE = "https://api.fiber.ai";

function getKey(): string | null {
  return process.env.FIBER_API_KEY ?? null;
}

export function hasFiber(): boolean {
  return Boolean(getKey());
}

export type RevealedContact = {
  email?: string;
  emailStatus?: string;
  phone?: string;
  location?: string;
  title?: string;
  raw: string;
};

/** Reveal contact details for a LinkedIn URL. Returns null on failure. */
export async function revealContact(
  linkedinUrl: string,
): Promise<RevealedContact | null> {
  const apiKey = getKey();
  if (!apiKey || !linkedinUrl) return null;

  const { value } = await withRedisCache<RevealedContact>({
    namespace: "fiber-reveal",
    keyParts: ["reveal", linkedinUrl],
    ttlSeconds: 60 * 15, // short TTL — contact data goes stale quickly
    fetch: async () => revealContactLive(linkedinUrl),
  });
  return value;
}

async function revealContactLive(
  linkedinUrl: string,
): Promise<RevealedContact | null> {
  const apiKey = getKey();
  if (!apiKey || !linkedinUrl) return null;

  try {
    const response = await fetch(`${FIBER_BASE}/v1/contact-details/single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        linkedinUrl,
        enrichmentType: {
          getWorkEmails: true,
          getPersonalEmails: false,
          getPhoneNumbers: true,
        },
        validateEmails: true,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      console.warn("Fiber reveal failed", response.status);
      return null;
    }

    const payload = (await response.json()) as {
      output?: {
        profile?: {
          emails?: Array<{ email?: string; type?: string; status?: string }>;
          phoneNumbers?: Array<{ number?: string; type?: string }>;
          location?: string;
          city?: string;
          country?: string;
          headline?: string;
          title?: string;
          jobTitle?: string;
          currentTitle?: string;
          company?: string;
          currentCompany?: string;
        };
      };
    };

    const profile = payload.output?.profile;
    const emails = profile?.emails ?? [];
    const phones = profile?.phoneNumbers ?? [];

    const best =
      emails.find((e) => e.type === "work" && e.email) ??
      emails.find((e) => e.email);

    const location =
      profile?.location ??
      [profile?.city, profile?.country].filter(Boolean).join(", ") ??
      undefined;
    const title =
      profile?.headline ??
      profile?.currentTitle ??
      profile?.jobTitle ??
      profile?.title ??
      undefined;

    if (!best?.email && phones.length === 0 && !location && !title) return null;

    return {
      email: best?.email,
      emailStatus: best?.status,
      phone: phones[0]?.number,
      location: location && location.length > 0 ? location : undefined,
      title: title && title.length > 0 ? title : undefined,
      raw: JSON.stringify(payload.output ?? {}),
    };
  } catch (err) {
    console.warn("Fiber reveal error", err);
    return null;
  }
}
