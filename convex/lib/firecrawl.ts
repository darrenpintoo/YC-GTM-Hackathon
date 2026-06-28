/**
 * Firecrawl integration — real web scraping for event sources.
 *
 * `/v2/scrape` renders JS-heavy pages server-side and returns clean markdown,
 * which is far better LLM input than a regex HTML strip. `/v2/search` lets us
 * discover an exhibitor/sponsor page when the user only gives an event name.
 *
 * Every call degrades gracefully: a missing key or API error returns null so
 * the caller can fall back to the cached snapshot and never break a run.
 */

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

function getKey(): string | null {
  return process.env.FIRECRAWL_API_KEY ?? null;
}

export function hasFirecrawl(): boolean {
  return Boolean(getKey());
}

export type FirecrawlScrape = {
  markdown: string;
  url: string;
};

/** Scrape a single URL to clean markdown. Returns null on any failure. */
export async function scrapeMarkdown(
  url: string,
  maxChars = 50_000,
): Promise<FirecrawlScrape | null> {
  const key = getKey();
  if (!key) return null;

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 45_000,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      console.warn("Firecrawl scrape failed", response.status, await safeText(response));
      return null;
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: { markdown?: string; metadata?: { sourceURL?: string; url?: string } };
    };

    const markdown = payload.data?.markdown?.trim();
    if (!markdown || markdown.length < 100) return null;

    return {
      markdown: markdown.slice(0, maxChars),
      url: payload.data?.metadata?.sourceURL ?? payload.data?.metadata?.url ?? url,
    };
  } catch (err) {
    console.warn("Firecrawl scrape error", err);
    return null;
  }
}

export type MappedLink = {
  url: string;
  title?: string;
  description?: string;
};

/**
 * Discover URLs on a site via /v2/map (1 credit, returns up to `limit` links).
 * Optional `search` filters links by keyword relevance. Returns [] on failure.
 */
export async function mapSite(
  url: string,
  opts?: { limit?: number; search?: string },
): Promise<MappedLink[]> {
  const key = getKey();
  if (!key) return [];

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/map`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        limit: opts?.limit ?? 200,
        ...(opts?.search ? { search: opts.search } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      console.warn("Firecrawl map failed", response.status, await safeText(response));
      return [];
    }

    const payload = (await response.json()) as {
      links?: Array<{ url?: string; title?: string; description?: string }>;
      data?: Array<{ url?: string; title?: string; description?: string }>;
    };

    const links = payload.links ?? payload.data ?? [];
    return links
      .filter((l): l is { url: string } & MappedLink => Boolean(l.url))
      .map((l) => ({
        url: l.url,
        title: l.title,
        description: l.description,
      }));
  } catch (err) {
    console.warn("Firecrawl map error", err);
    return [];
  }
}

export type BatchScrapeDoc = {
  url: string;
  markdown: string;
};

const BATCH_CHUNK_SIZE = 15;

/**
 * Scrape many URLs to markdown. Splits the list into chunks and runs the
 * sync /v2/batch/scrape calls in parallel (the endpoint is already parallel
 * server-side; chunking avoids one huge slow/timeout call). Falls back to a
 * bounded-concurrency loop of scrapeMarkdown for any chunk that fails. Always
 * returns whatever it managed to gather (never throws).
 */
export async function batchScrape(
  urls: string[],
  maxChars = 30_000,
): Promise<BatchScrapeDoc[]> {
  const key = getKey();
  if (!key || urls.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(urls.slice(i, i + BATCH_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) => batchScrapeChunk(chunk, maxChars)),
  );

  // Dedupe by URL across chunks (cheap safety; chunks are disjoint already).
  const seen = new Set<string>();
  const out: BatchScrapeDoc[] = [];
  for (const doc of results.flat()) {
    if (seen.has(doc.url)) continue;
    seen.add(doc.url);
    out.push(doc);
  }
  return out;
}

/** Scrape a single chunk via the batch endpoint, falling back to a loop. */
async function batchScrapeChunk(
  urls: string[],
  maxChars: number,
): Promise<BatchScrapeDoc[]> {
  if (urls.length === 0) return [];
  const key = getKey();
  if (!key) return [];

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/batch/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls,
        formats: ["markdown"],
        onlyMainContent: true,
        ignoreInvalidURLs: true,
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        data?: Array<{
          markdown?: string;
          metadata?: { sourceURL?: string; url?: string };
        }>;
      };
      const docs = (payload.data ?? [])
        .map((d) => ({
          url: d.metadata?.sourceURL ?? d.metadata?.url ?? "",
          markdown: (d.markdown ?? "").trim().slice(0, maxChars),
        }))
        .filter((d) => d.url && d.markdown.length >= 200);
      if (docs.length > 0) return docs;
    } else {
      console.warn("Firecrawl batch scrape failed", response.status);
    }
  } catch (err) {
    console.warn("Firecrawl batch scrape error, falling back to loop", err);
  }

  return scrapeMany(urls, maxChars);
}

/** Bounded-concurrency fallback: scrape URLs individually. */
async function scrapeMany(
  urls: string[],
  maxChars: number,
): Promise<BatchScrapeDoc[]> {
  const out: BatchScrapeDoc[] = [];
  const concurrency = 8;
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((u) => scrapeMarkdown(u, maxChars)),
    );
    for (const r of results) {
      if (r && r.markdown.length >= 200) {
        out.push({ url: r.url, markdown: r.markdown });
      }
    }
  }
  return out;
}

export type FirecrawlSearchResult = {
  title: string;
  url: string;
  markdown?: string;
};

/**
 * Search the web for an event's exhibitor/sponsor source and scrape the top
 * hit to markdown in the same call. Returns null on any failure.
 */
export async function searchEventSource(
  query: string,
): Promise<FirecrawlSearchResult | null> {
  const key = getKey();
  if (!key) return null;

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 3,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      console.warn("Firecrawl search failed", response.status, await safeText(response));
      return null;
    }

    const payload = (await response.json()) as {
      data?:
        | { web?: Array<{ title?: string; url?: string; markdown?: string }> }
        | Array<{ title?: string; url?: string; markdown?: string }>;
    };

    const results = Array.isArray(payload.data)
      ? payload.data
      : (payload.data?.web ?? []);

    const best = results.find((r) => r.url && (r.markdown?.length ?? 0) > 100);
    if (!best?.url) return null;

    return {
      title: best.title ?? query,
      url: best.url,
      markdown: best.markdown?.slice(0, 50_000),
    };
  } catch (err) {
    console.warn("Firecrawl search error", err);
    return null;
  }
}

/** Search the web and return multiple result URLs (no scraping). [] on failure. */
export async function searchUrls(
  query: string,
  limit = 5,
): Promise<MappedLink[]> {
  const key = getKey();
  if (!key) return [];

  try {
    const response = await fetch(`${FIRECRAWL_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      console.warn("Firecrawl searchUrls failed", response.status);
      return [];
    }

    const payload = (await response.json()) as {
      data?:
        | { web?: Array<{ title?: string; url?: string; description?: string }> }
        | Array<{ title?: string; url?: string; description?: string }>;
    };

    const results = Array.isArray(payload.data)
      ? payload.data
      : (payload.data?.web ?? []);

    return results
      .filter((r): r is { url: string } & MappedLink => Boolean(r.url))
      .map((r) => ({ url: r.url, title: r.title, description: r.description }));
  } catch (err) {
    console.warn("Firecrawl searchUrls error", err);
    return [];
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "";
  }
}
