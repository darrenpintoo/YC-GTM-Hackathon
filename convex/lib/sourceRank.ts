/**
 * Bronze-layer URL discovery scoring, dedup, and category-budget selection.
 */

export const MAX_SOURCES = 50;
export const MAX_RECURRING_SHARE = 0.4;

export const RELEVANCE_KEYWORDS = [
  "sponsor",
  "exhibit",
  "partner",
  "supporter",
  "program",
  "speaker",
  "keynote",
  "plenary",
  "organizer",
  "organiser",
  "committee",
  "attend",
  "participant",
  "floorplan",
  "floor-plan",
];

const URL_BLOCKLIST = [
  "/register",
  "/login",
  "/signin",
  "/sign-in",
  "/signup",
  "/sign-up",
  "/hotel",
  "/travel",
  "/privacy",
  "/faq",
  "/contact",
  "/about",
  "/careers",
  "/cookie",
  "/terms",
  "/legal",
  "/account",
  "/cart",
  "/checkout",
];

const CATEGORY_BOOST: Record<string, number> = {
  sponsors: 4,
  exhibitors: 2,
  speakers: 3,
  program: 1,
  news: 1,
  event: 1,
  past_edition: 0,
  other: 0,
};

export const CATEGORY_BUDGETS: Record<string, number> = {
  sponsors: 12,
  exhibitors: 18,
  speakers: 10,
  program: 4,
  news: 4,
  event: 6,
  other: 2,
  past_edition: 12,
};

export type SignalTier = "high" | "medium" | "low";

export type RankedCandidate = {
  url: string;
  title?: string;
  description?: string;
  category: string;
  recurring: boolean;
  editionLabel?: string;
  discoveryScore: number;
  signalTier?: SignalTier;
  triageSkip?: boolean;
};

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.search = "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

export function isBlocklisted(url: string): boolean {
  const hay = url.toLowerCase();
  return URL_BLOCKLIST.some((token) => hay.includes(token));
}

export function relevanceScore(link: {
  url: string;
  title?: string;
  description?: string;
}): number {
  const hay = `${link.url} ${link.title ?? ""} ${link.description ?? ""}`.toLowerCase();
  let score = 0;
  for (const kw of RELEVANCE_KEYWORDS) {
    if (hay.includes(kw)) score += 1;
  }
  return score;
}

export function categorize(url: string, hint: string): string {
  const hay = `${url} ${hint}`.toLowerCase();
  if (hay.includes("sponsor") || hay.includes("supporter")) return "sponsors";
  if (hay.includes("exhibit")) return "exhibitors";
  if (
    hay.includes("speaker") ||
    hay.includes("keynote") ||
    hay.includes("plenary")
  )
    return "speakers";
  if (
    hay.includes("program") ||
    hay.includes("agenda") ||
    hay.includes("schedule")
  )
    return "program";
  if (
    hay.includes("news") ||
    hay.includes("press") ||
    hay.includes("blog") ||
    hay.includes("announce")
  )
    return "news";
  return "event";
}

export function scoreCandidate(
  candidate: Omit<RankedCandidate, "discoveryScore">,
  opts: {
    seedHost?: string;
    eventYear?: number;
    hostCounts: Map<string, number>;
  },
): number {
  if (isBlocklisted(candidate.url)) return -100;

  let score = relevanceScore(candidate);
  score += CATEGORY_BOOST[candidate.category] ?? 0;

  const host = hostOf(candidate.url);
  if (opts.seedHost && host === opts.seedHost) score += 2;

  const hay = `${candidate.url} ${candidate.title ?? ""}`.toLowerCase();
  if (opts.eventYear && hay.includes(String(opts.eventYear))) score += 2;

  const hostCount = opts.hostCounts.get(host) ?? 0;
  if (hostCount >= 4) score -= (hostCount - 3) * 0.5;
  opts.hostCounts.set(host, hostCount + 1);

  if (candidate.signalTier === "high") score += 5;
  else if (candidate.signalTier === "medium") score += 2;
  else if (candidate.signalTier === "low") score -= 1;

  if (candidate.triageSkip) score -= 100;

  return score;
}

/** Collapse near-duplicate URLs; prefer current-year paths when tied. */
export function dedupeCandidates(
  candidates: Omit<RankedCandidate, "discoveryScore">[],
  eventYear?: number,
): Omit<RankedCandidate, "discoveryScore">[] {
  const byNorm = new Map<string, Omit<RankedCandidate, "discoveryScore">>();

  for (const c of candidates) {
    const norm = normalizeUrl(c.url);
    const prior = byNorm.get(norm);
    if (!prior) {
      byNorm.set(norm, c);
      continue;
    }
    const cYear = eventYear && c.url.includes(String(eventYear)) ? 1 : 0;
    const pYear = eventYear && prior.url.includes(String(eventYear)) ? 1 : 0;
    if (cYear > pYear) byNorm.set(norm, c);
  }

  return Array.from(byNorm.values());
}

export function rankCandidates(
  candidates: Omit<RankedCandidate, "discoveryScore">[],
  opts: { seedHost?: string; eventYear?: number },
): RankedCandidate[] {
  const hostCounts = new Map<string, number>();
  return candidates
    .map((c) => ({
      ...c,
      discoveryScore: scoreCandidate(c, {
        seedHost: opts.seedHost,
        eventYear: opts.eventYear,
        hostCounts,
      }),
    }))
    .sort((a, b) => b.discoveryScore - a.discoveryScore);
}

/**
 * Select up to MAX_SOURCES using category budgets. Recurring/past_edition
 * capped at MAX_RECURRING_SHARE of total.
 */
export function selectCandidates(ranked: RankedCandidate[]): RankedCandidate[] {
  const maxRecurring = Math.floor(MAX_SOURCES * MAX_RECURRING_SHARE);
  const budgets: Record<string, number> = {
    ...CATEGORY_BUDGETS,
    past_edition: maxRecurring,
  };
  const used: Record<string, number> = {};
  const selected: RankedCandidate[] = [];

  const tryAdd = (c: RankedCandidate) => {
    if (selected.length >= MAX_SOURCES) return false;
    if (c.triageSkip || c.discoveryScore < 0) return false;
    if (c.signalTier === "low" && selected.length >= MAX_SOURCES - 5) return false;

    const bucket = c.recurring ? "past_edition" : c.category;
    const cap = budgets[bucket] ?? 4;
    const count = used[bucket] ?? 0;
    if (count >= cap) return false;

    used[bucket] = count + 1;
    selected.push(c);
    return true;
  };

  // First pass: honor strict budgets for high-signal pages.
  for (const c of ranked) {
    if (c.triageSkip) continue;
    tryAdd(c);
  }

  // Second pass: fill remaining slots by score.
  for (const c of ranked) {
    if (selected.some((s) => normalizeUrl(s.url) === normalizeUrl(c.url))) continue;
    if (c.triageSkip || c.discoveryScore < 0) continue;
    if (selected.length >= MAX_SOURCES) break;
    selected.push(c);
  }

  return selected;
}

export function rankLinks<T extends { url: string; title?: string; description?: string }>(
  links: T[],
): T[] {
  return links
    .map((l) => ({ link: l, score: relevanceScore(l) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.link);
}
