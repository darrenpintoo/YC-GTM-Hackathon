import { DEMO_EXHIBITOR_SNAPSHOT } from "./demoSeed";

export type ResolvedSource = {
  text: string;
  url?: string;
  kind: "url" | "paste" | "snapshot";
};

const MAX_FETCH_CHARS = 50_000;

/**
 * Resolve exhibitor/sponsor source text from a URL, pasted content, or fallback snapshot.
 * URL fetch is best-effort — many exhibitor sites block bots or return SPA shells.
 */
export async function resolveEventSourceText(
  eventSource: string,
): Promise<ResolvedSource> {
  const trimmed = eventSource.trim();
  if (!trimmed) {
    return { text: DEMO_EXHIBITOR_SNAPSHOT, kind: "snapshot" };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const response = await fetch(trimmed, {
        headers: {
          "User-Agent": "SchruteBot/1.0 (event-ingest)",
          Accept: "text/html,text/plain,*/*",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) {
        const raw = await response.text();
        const text = stripHtml(raw).slice(0, MAX_FETCH_CHARS);
        if (text.length > 200) {
          return { text, url: trimmed, kind: "url" };
        }
      }
    } catch (err) {
      console.warn("Event URL fetch failed, using fallback snapshot", err);
    }
    return {
      text: DEMO_EXHIBITOR_SNAPSHOT,
      url: trimmed,
      kind: "snapshot",
    };
  }

  return { text: trimmed.slice(0, MAX_FETCH_CHARS), kind: "paste" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
