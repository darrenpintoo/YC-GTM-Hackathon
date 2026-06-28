/**
 * Server-side match reason helpers (mirrors lib/attendeeConnection.ts for Convex).
 */

export type MatchReasonContext = {
  eventName: string;
  sellerName?: string;
  buyerTitles?: string[];
  industries?: string[];
  matchTier?: "tier1_crm" | "tier2_icp";
  matchedOppValue?: number;
  network?: "linkedin" | "x" | "web";
  postQuote?: string;
  fullName?: string;
  title?: string;
  companyName?: string;
};

const GENERIC_REASON =
  /\b(works at|valuable contact|collaboration opport|key connection|relevant to our|intersects with|aligns with our (robotics|target|icp|initiatives|offerings)|offering insights|making them a|in robotics|focuses on robotics|innovative advancements|worth meeting because they)\b/i;

export function isGenericMatchReason(reason: string): boolean {
  const t = reason.trim();
  if (t.length < 24) return true;
  if (GENERIC_REASON.test(t)) return true;
  const hasSignal =
    /\b(attend|attending|speak|speaker|keynote|exhibit|booth|sponsor|posted|post|floor|crm|pipeline|open opp|pre-show|meet|session|program)\b/i.test(
      t,
    );
  return !hasSignal;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function titleMatchesBuyer(title: string, buyerTitles: string[]): boolean {
  const t = title.toLowerCase();
  return buyerTitles.some((b) => {
    const words = b.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => t.includes(w));
  });
}

export function buildMatchReason(ctx: MatchReasonContext): string {
  const event = ctx.eventName;
  const title = ctx.title?.trim() || "contact";
  const company = ctx.companyName?.trim() || "their company";
  const quote = ctx.postQuote?.trim() ?? "";
  const buyers = ctx.buyerTitles ?? [];
  const buyerHint = buyers.slice(0, 2).join(" / ") || "your buyer titles";
  const seller = ctx.sellerName ?? "your team";

  if (ctx.matchTier === "tier1_crm") {
    const pipeline =
      ctx.matchedOppValue && ctx.matchedOppValue > 0
        ? ` — ${formatUsd(ctx.matchedOppValue)} open in CRM`
        : "";
    if (quote && /\b(speak|keynote|panel|present|session)\b/i.test(quote)) {
      return `CRM account${pipeline}; speaking at ${event} — schedule ${title} before sessions fill.`;
    }
    if (quote && /\b(exhibit|booth|sponsor|floor)\b/i.test(quote)) {
      return `Active CRM account${pipeline}; on the ${event} floor — prioritize a booth walk-by.`;
    }
    if (quote && /\b(attend|going|see you|heading to|excited for)\b/i.test(quote)) {
      return `Posted about ${event}${pipeline}; warm outreach while they're already planning the trip.`;
    }
    if (ctx.network === "web") {
      return `Named on the ${event} program${pipeline}; ${title} is a direct line into ${company}.`;
    }
    return `Tier-1 CRM at ${event}${pipeline}; ${title} maps to ${buyerHint} — worth a ${seller} intro.`;
  }

  if (ctx.matchTier === "tier2_icp") {
    if (quote && /\b(exhibit|booth|sponsor|first time)\b/i.test(quote)) {
      return `Net-new ICP prospect exhibiting at ${event} — route to a rep before the show.`;
    }
    if (titleMatchesBuyer(title, buyers)) {
      return `ICP-fit ${title} at ${company} for ${event}; title matches ${buyerHint}.`;
    }
    return `Strong-fit prospect at ${event}; ${company} sits in your ICP — qualify on the floor.`;
  }

  if (ctx.network === "web" && quote) {
    return `Program speaker at ${event}; use ${ctx.fullName ?? "them"} as a warm path into ${company}.`;
  }

  if (quote) {
    const signal = quote.slice(0, 72).replace(/\s+/g, " ").trim();
    return `Public post about ${event}: “${signal}${quote.length > 72 ? "…" : ""}” — check ICP fit.`;
  }

  return `Public ${ctx.network === "x" ? "X" : ctx.network === "linkedin" ? "LinkedIn" : "event"} signal for ${event}.`;
}

export function resolveMatchReason(
  aiReason: string | undefined,
  ctx: MatchReasonContext,
): string {
  const trimmed = aiReason?.trim();
  if (trimmed && !isGenericMatchReason(trimmed)) return trimmed;
  return buildMatchReason(ctx);
}
