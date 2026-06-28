/**
 * Grounded one-liners for why an account is worth meeting at an event.
 * Shared by AccountDrawer (client) and enrich/pipeline (server).
 */

import { isGenericMatchReason } from "./attendeeConnection";

export type AccountMeetingContext = {
  eventName: string;
  sellerName?: string;
  buyerTitles?: string[];
  companyName: string;
  domain?: string;
  tier: "tier1_crm" | "tier2_icp";
  role: string;
  boothOrSession?: string;
  matchedOppValue?: number;
  contactName?: string;
  contactTitle?: string;
  evidenceQuote?: string;
  presence?: "confirmed" | "recurring";
  editionLabel?: string;
};

const SPONSORSHIP_LISTING =
  /\b(sponsorship|sponsor level|gold sponsor|silver sponsor|bronze sponsor|platinum sponsor|beverage station|networking break|lanyard|bag sponsor|media partner|official partner)\b/i;

const GENERIC_COMPANY =
  /\b(station|package|level|tier|break|lounge|pavilion|pavilion sponsorship)\b/i;

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function looksLikeListing(ctx: AccountMeetingContext): boolean {
  const name = ctx.companyName.toLowerCase();
  if (SPONSORSHIP_LISTING.test(ctx.companyName)) return true;
  if (GENERIC_COMPANY.test(name) && !ctx.domain) return true;
  if (name.split(/\s+/).length >= 4 && /\b(sponsor|sponsorship|station)\b/i.test(name)) {
    return true;
  }
  return false;
}

/** Rule-based fallback when AI output is missing or too generic. */
export function buildAccountMeetingReason(ctx: AccountMeetingContext): string {
  const event = ctx.eventName;
  const quote = ctx.evidenceQuote?.trim() ?? "";
  const booth = ctx.boothOrSession ? ` (${ctx.boothOrSession})` : "";
  const buyers = ctx.buyerTitles ?? [];
  const buyerHint = buyers.slice(0, 2).join(" / ") || "your buyer titles";

  if (looksLikeListing(ctx)) {
    return `Event sponsorship listing — not a named buyer account. Deprioritize unless ${buyers[0] ?? "this category"} is in your ICP.`;
  }

  if (ctx.tier === "tier1_crm") {
    const pipeline =
      ctx.matchedOppValue && ctx.matchedOppValue > 0
        ? ` — ${formatUsd(ctx.matchedOppValue)} open in CRM`
        : "";
    if (ctx.contactName?.trim()) {
      const title = ctx.contactTitle?.trim() || "Decision maker";
      if (quote && /\b(speak|keynote|panel|present|session)\b/i.test(quote)) {
        return `CRM account${pipeline}; ${ctx.contactName} speaking at ${event} — book ${title} before sessions fill.`;
      }
      return `Active CRM account${pipeline}; ${ctx.contactName} (${title}) tied to ${event} floor presence — prioritize a meeting.`;
    }
    if (quote && /\b(speak|keynote|panel|present|session)\b/i.test(quote)) {
      return `CRM account${pipeline}; on the ${event} program — walk the session and book time with their team.`;
    }
    if (quote && /\b(exhibit|booth|sponsor|floor)\b/i.test(quote)) {
      return `Active CRM account${pipeline}; confirmed on the ${event} floor${booth} — send a rep for a booth walk-by.`;
    }
    if (ctx.presence === "recurring" && ctx.editionLabel) {
      return `CRM account${pipeline}; attended ${ctx.editionLabel} and likely returning — pre-book before ${event}.`;
    }
    return `Tier-1 CRM at ${event}${pipeline}; maps to ${buyerHint} — worth a direct intro on the floor.`;
  }

  if (ctx.tier === "tier2_icp") {
    if (ctx.contactName?.trim()) {
      return `Net-new ICP prospect; ${ctx.contactName} named at ${event}${booth} — qualify on-site.`;
    }
    if (quote && /\b(exhibit|booth|sponsor|first time)\b/i.test(quote)) {
      return `Strong-fit prospect exhibiting at ${event}${booth} — route to a rep before the show.`;
    }
    if (ctx.role === "speaker") {
      return `ICP-fit speaker at ${event}; use their session as a warm path into ${ctx.companyName}.`;
    }
    return `Net-new ICP match at ${event}; ${ctx.companyName} fits your profile — qualify on the floor.`;
  }

  return `Confirmed presence at ${event}${booth}; check ICP fit before booking time.`;
}

export function resolveAccountMeetingReason(
  aiReason: string | undefined,
  ctx: AccountMeetingContext,
): string {
  const trimmed = aiReason?.trim();
  if (trimmed && !isGenericMatchReason(trimmed)) return trimmed;
  return buildAccountMeetingReason(ctx);
}
