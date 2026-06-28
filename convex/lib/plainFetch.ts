const MAX_FETCH_CHARS = 50_000;

/** Plain HTTP fetch + HTML strip when Firecrawl is unavailable or fails. */
export async function plainFetch(
  url: string,
  maxChars = MAX_FETCH_CHARS,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SchruteBot/1.0 (event-ingest)",
        Accept: "text/html,text/plain,*/*",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    const text = stripHtml(raw).slice(0, maxChars);
    return text.length > 200 ? text : null;
  } catch (err) {
    console.warn("Plain URL fetch failed", err);
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
