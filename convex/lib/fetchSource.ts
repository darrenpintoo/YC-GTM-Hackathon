import { DEMO_EXHIBITOR_SNAPSHOT } from "./demoSeed";
import { hasFirecrawl, scrapeMarkdown, searchEventSource } from "./firecrawl";
import { plainFetch } from "./plainFetch";

export type ResolvedSource = {
  text: string;
  url?: string;
  kind: "url" | "paste" | "snapshot";
};

const MAX_FETCH_CHARS = 50_000;

/**
 * Resolve exhibitor/sponsor source text from a URL, pasted content, an event
 * name, or a fallback snapshot.
 *
 * Order of preference:
 *   1. URL          -> Firecrawl scrape (clean markdown, JS-rendered) then a
 *                       plain fetch, then snapshot.
 *   2. Pasted text  -> use as-is.
 *   3. Event name   -> Firecrawl search for an exhibitor/sponsor page.
 *   4. Empty / fail -> cached snapshot so a run is never blocked.
 */
export async function resolveEventSourceText(
  eventSource: string,
): Promise<ResolvedSource> {
  const trimmed = eventSource.trim();
  if (!trimmed) {
    return { text: DEMO_EXHIBITOR_SNAPSHOT, kind: "snapshot" };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const scraped = await scrapeMarkdown(trimmed, MAX_FETCH_CHARS);
    if (scraped) {
      return { text: scraped.markdown, url: scraped.url, kind: "url" };
    }

    const plain = await plainFetch(trimmed);
    if (plain) {
      return { text: plain, url: trimmed, kind: "url" };
    }

    return { text: DEMO_EXHIBITOR_SNAPSHOT, url: trimmed, kind: "snapshot" };
  }

  // Looks like pasted source content (multi-line or long) — use it directly.
  if (trimmed.includes("\n") || trimmed.length > 120) {
    return { text: trimmed.slice(0, MAX_FETCH_CHARS), kind: "paste" };
  }

  // Otherwise treat it as an event name and search the web for a source page.
  if (hasFirecrawl()) {
    const found = await searchEventSource(
      `${trimmed} exhibitor list sponsors speakers`,
    );
    if (found?.markdown) {
      return { text: found.markdown, url: found.url, kind: "url" };
    }
  }

  // Short free-text with no URL and no search hit: keep it as pasted context.
  return { text: trimmed.slice(0, MAX_FETCH_CHARS), kind: "paste" };
}
