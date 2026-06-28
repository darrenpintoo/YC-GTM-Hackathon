/**
 * Upstash Redis REST cache for expensive external API responses during demos.
 * Gated by SCHRUTE_DEMO_CACHE=1 plus UPSTASH_REDIS_REST_URL/TOKEN.
 * When disabled or on error, callers fall through to live API behavior.
 */

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function isDemoCacheEnabled(): boolean {
  return (
    process.env.SCHRUTE_DEMO_CACHE === "1" &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export type CacheResult<T> = {
  value: T;
  fromCache: boolean;
};

/** Stable short hash for cache keys (no Node crypto required). */
export async function hashPayload(parts: string[]): Promise<string> {
  const text = parts.join("\0");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

function cacheKey(namespace: string, digest: string): string {
  return `schrute:${namespace}:${digest}`;
}

async function redisCommand(
  command: (string | number)[],
): Promise<unknown> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return null;

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn("Redis command failed", response.status);
      return null;
    }
    const payload = (await response.json()) as { result?: unknown };
    return payload.result ?? null;
  } catch (err) {
    console.warn("Redis command error", err);
    return null;
  }
}

async function redisGet(key: string): Promise<string | null> {
  const result = await redisCommand(["GET", key]);
  if (result == null) return null;
  return typeof result === "string" ? result : null;
}

async function redisSetEx(
  key: string,
  ttlSeconds: number,
  value: string,
): Promise<void> {
  await redisCommand(["SET", key, value, "EX", ttlSeconds]);
}

/**
 * Read-through cache for JSON-serializable API responses.
 * `fetch` should return null when the live call fails (same as today).
 */
export async function withRedisCache<T>(args: {
  namespace: string;
  keyParts: string[];
  ttlSeconds?: number;
  fetch: () => Promise<T | null>;
}): Promise<CacheResult<T | null>> {
  if (!isDemoCacheEnabled()) {
    return { value: await args.fetch(), fromCache: false };
  }

  const digest = await hashPayload(args.keyParts);
  const key = cacheKey(args.namespace, digest);

  try {
    const cached = await redisGet(key);
    if (cached) {
      return { value: JSON.parse(cached) as T, fromCache: true };
    }
  } catch (err) {
    console.warn("Redis cache read failed", err);
  }

  const value = await args.fetch();
  if (value != null) {
    try {
      await redisSetEx(
        key,
        args.ttlSeconds ?? DEFAULT_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch (err) {
      console.warn("Redis cache write failed", err);
    }
  }

  return { value, fromCache: false };
}
