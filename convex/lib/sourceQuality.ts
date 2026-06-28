/**
 * Silver-layer pre-extraction quality scoring and routing.
 */

import type { SignalTier } from "./sourceRank";

export type ExtractionRoute = "full" | "hybrid" | "skip";

export type SourceQualityResult = {
  score: number;
  companyDensity: number;
  roleKeywordHits: number;
  listStructure: number;
  noiseRatio: number;
  route: ExtractionRoute;
};

const ORG_PATTERN =
  /\b(Inc\.|LLC|Corp\.|Corporation|Ltd\.|GmbH|Company|Co\.|University|Institute|Lab|Group|Systems|Technologies|Robotics)\b/i;

const ROLE_KEYWORDS = [
  "sponsor",
  "exhibitor",
  "booth",
  "speaker",
  "keynote",
  "partner",
  "session",
  "platinum",
  "gold sponsor",
];

const NOISE_PATTERNS = [
  /^menu$/i,
  /^home$/i,
  /^back to top/i,
  /^cookie/i,
  /^subscribe/i,
  /^follow us/i,
  /^copyright/i,
  /^all rights reserved/i,
];

function countMatches(text: string, patterns: RegExp[] | string[]): number {
  const lines = text.split(/\r?\n/);
  let hits = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const p of patterns) {
      if (typeof p === "string") {
        if (trimmed.toLowerCase().includes(p)) hits += 1;
      } else if (p.test(trimmed)) {
        hits += 1;
      }
    }
  }
  return hits;
}

export function scoreSourceQuality(
  markdown: string,
  category: string | null,
  signalTier: SignalTier | null | undefined,
  charCount?: number,
): SourceQualityResult {
  const text = markdown.trim();
  const len = charCount ?? text.length;

  if (len < 200) {
    return {
      score: 0,
      companyDensity: 0,
      roleKeywordHits: 0,
      listStructure: 0,
      noiseRatio: 1,
      route: "skip",
    };
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const lineCount = Math.max(lines.length, 1);

  const orgHits = countMatches(text, [ORG_PATTERN]);
  const companyDensity = orgHits / lineCount;

  let roleKeywordHits = 0;
  const hay = text.toLowerCase();
  for (const kw of ROLE_KEYWORDS) {
    if (hay.includes(kw)) roleKeywordHits += 1;
  }

  const listLines = lines.filter((l) => /^[\s]*[-*•]\s+\S/.test(l)).length;
  const pipeLines = lines.filter((l) => l.includes("|") && l.split("|").length >= 2).length;
  const listStructure = (listLines + pipeLines) / lineCount;

  const noiseHits = countMatches(text, NOISE_PATTERNS);
  const noiseRatio = Math.min(1, noiseHits / lineCount);

  let score =
    companyDensity * 4 +
    Math.min(roleKeywordHits, 6) * 0.5 +
    listStructure * 3 -
    noiseRatio * 2;

  if (category === "sponsors" || category === "speakers") score += 1.5;
  if (category === "exhibitors") score += 1;
  if (signalTier === "high") score += 2;
  else if (signalTier === "medium") score += 1;
  else if (signalTier === "low") score -= 1;

  let route: ExtractionRoute = "full";
  if (score < 1.5 && signalTier === "low") route = "skip";
  else if (listStructure >= 0.25 || companyDensity >= 0.08) route = "hybrid";
  else if (score >= 3 || signalTier === "high" || signalTier === "medium")
    route = "full";
  else if (score < 2) route = "skip";

  return {
    score,
    companyDensity,
    roleKeywordHits,
    listStructure,
    noiseRatio,
    route,
  };
}

/** Sort source docs for silver extraction (sponsors first). */
export function categorySortKey(
  category: string | null,
  recurring: boolean,
): number {
  if (recurring) return 90;
  switch (category) {
    case "sponsors":
      return 0;
    case "speakers":
      return 10;
    case "exhibitors":
      return 20;
    case "news":
      return 40;
    case "program":
      return 50;
    case "event":
      return 60;
    case "past_edition":
      return 80;
    default:
      return 70;
  }
}
