import {
  domainMatchesCompanyName,
  fuzzyNameScore,
  normalizeCompanyName,
  normalizeDomain,
} from "./normalize";

const DOMAIN_HINTS: Record<string, string> = {
  "turner construction": "turnerconstruction.com",
  skanska: "usa.skanska.com",
  "clark construction": "clarkconstruction.com",
  mortenson: "mortenson.com",
  haskell: "haskell.com",
  "brasfield gorrie": "brasfieldgorrie.com",
  gilbane: "gilbaneco.com",
  "suffolk construction": "suffolk.com",
  mccarthy: "mccarthy.com",
  kiewit: "kiewit.com",
  "buildright materials": "buildrightmaterials.com",
};

export type ResolvedCompany = {
  companyName: string;
  domain?: string;
  confidence: number;
  source: "domain_lookup" | "fiber" | "fuzzy_name" | "unknown";
};

export async function resolveCompany(
  companyName: string,
  hints?: { domain?: string },
): Promise<ResolvedCompany> {
  const normalized = normalizeCompanyName(companyName);
  const hintedDomain = hints?.domain
    ? normalizeDomain(hints.domain)
    : DOMAIN_HINTS[normalized];

  if (hintedDomain) {
    return {
      companyName,
      domain: hintedDomain,
      confidence: hints?.domain ? 0.95 : 0.85,
      source: hints?.domain ? "domain_lookup" : "fuzzy_name",
    };
  }

  return {
    companyName,
    confidence: 0.4,
    source: "unknown",
  };
}

export type CrmAccountLite = {
  _id: string;
  companyName: string;
  domain?: string;
  accountType: "closed_won" | "open_opp" | "target" | "other";
  industry?: string;
  openOppValue?: number;
};

export type EventCompanyLite = {
  _id: string;
  companyName: string;
  domain?: string;
  role: "exhibitor" | "sponsor" | "speaker" | "unknown";
  boothOrSession?: string;
  quote: string;
  confidence: number;
  sourceDocumentId: string;
  sourceUrl: string;
};

export type RevenueProfileLite = {
  industries: string[];
  buyerTitles: string[];
  keywords: string[];
  geographies: string[];
};

export type MatchCandidate = {
  tier: "tier1_crm" | "tier2_icp";
  crmAccountId?: string;
  companyName: string;
  domain?: string;
  role: "exhibitor" | "sponsor" | "speaker" | "unknown";
  boothOrSession?: string;
  fitScore: number;
  confidence: number;
  matchedOppValue?: number;
  eventCompanyId: string;
  evidence: {
    sourceDocumentId: string;
    sourceUrl: string;
    quote: string;
    factType: "exhibitor" | "sponsor" | "speaker" | "unknown";
    confidence: number;
  };
};

export function matchAccounts(
  eventCompanies: EventCompanyLite[],
  crmAccounts: CrmAccountLite[],
  profile: RevenueProfileLite,
): MatchCandidate[] {
  const matches: MatchCandidate[] = [];
  const matchedCrmIds = new Set<string>();

  for (const company of eventCompanies) {
    const resolved = resolveCompanySync(company.companyName, company.domain);
    const domain = resolved.domain;

    const tier1 = findTier1Match(company, crmAccounts, domain);
    if (tier1) {
      if (matchedCrmIds.has(tier1.crm._id)) continue;
      matchedCrmIds.add(tier1.crm._id);
      matches.push(buildMatch(company, tier1.crm, tier1.confidence, tier1.fitScore));
      continue;
    }

    const fitScore = scoreIcpFit(company.companyName, company.role, profile);
    if (fitScore >= 0.55) {
      matches.push(buildNetNewMatch(company, fitScore));
    }
  }

  return rankMatches(matches);
}

function resolveCompanySync(companyName: string, domain?: string): ResolvedCompany {
  const normalized = normalizeCompanyName(companyName);
  const hintedDomain = domain
    ? normalizeDomain(domain)
    : DOMAIN_HINTS[normalized];

  if (hintedDomain) {
    return {
      companyName,
      domain: hintedDomain,
      confidence: domain ? 0.95 : 0.85,
      source: domain ? "domain_lookup" : "fuzzy_name",
    };
  }

  return { companyName, confidence: 0.4, source: "unknown" };
}

function findTier1Match(
  company: EventCompanyLite,
  crmAccounts: CrmAccountLite[],
  resolvedDomain?: string,
): { crm: CrmAccountLite; confidence: number; fitScore: number } | null {
  if (resolvedDomain) {
    const byDomain = crmAccounts.find(
      (crm) => normalizeDomain(crm.domain) === resolvedDomain,
    );
    if (byDomain) {
      return {
        crm: byDomain,
        confidence: Math.min(0.98, company.confidence + 0.02),
        fitScore: accountTypeFitScore(byDomain.accountType),
      };
    }
  }

  let best: { crm: CrmAccountLite; confidence: number; fitScore: number } | null =
    null;

  for (const crm of crmAccounts) {
    const nameScore = Math.max(
      fuzzyNameScore(company.companyName, crm.companyName),
      domainMatchesCompanyName(crm.domain, company.companyName) ? 0.9 : 0,
    );
    if (nameScore < 0.6) continue;

    const confidence = Math.min(0.9, company.confidence * (0.65 + nameScore * 0.35));
    const fitScore = accountTypeFitScore(crm.accountType) * (0.85 + nameScore * 0.15);

    if (!best || fitScore > best.fitScore) {
      best = { crm, confidence, fitScore };
    }
  }

  return best;
}

function accountTypeFitScore(
  accountType: CrmAccountLite["accountType"],
): number {
  switch (accountType) {
    case "open_opp":
      return 0.98;
    case "target":
      return 0.9;
    case "closed_won":
      return 0.86;
    default:
      return 0.7;
  }
}

function scoreIcpFit(
  companyName: string,
  role: EventCompanyLite["role"],
  profile: RevenueProfileLite,
): number {
  const haystack = companyName.toLowerCase();
  let score = 0.42;

  for (const industry of profile.industries) {
    const token = industry.toLowerCase().split(" ")[0];
    if (token && haystack.includes(token)) {
      score += 0.08;
    }
  }

  for (const keyword of profile.keywords) {
    const keywordTokens = keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length >= 5);
    if (
      haystack.includes(keyword.toLowerCase()) ||
      keywordTokens.some((token) => haystack.includes(token))
    ) {
      score += 0.05;
    }
  }

  if (role === "sponsor") score += 0.05;
  if (role === "exhibitor") score += 0.03;

  return Math.min(0.92, score);
}

function buildMatch(
  company: EventCompanyLite,
  crm: CrmAccountLite,
  confidence: number,
  fitScore: number,
): MatchCandidate {
  return {
    tier: "tier1_crm",
    crmAccountId: crm._id,
    companyName: crm.companyName,
    domain: crm.domain,
    role: company.role,
    boothOrSession: company.boothOrSession,
    fitScore,
    confidence,
    matchedOppValue: crm.openOppValue,
    eventCompanyId: company._id,
    evidence: {
      sourceDocumentId: company.sourceDocumentId,
      sourceUrl: company.sourceUrl,
      quote: company.quote,
      factType: roleToFactType(company.role),
      confidence: company.confidence,
    },
  };
}

function buildNetNewMatch(
  company: EventCompanyLite,
  fitScore: number,
): MatchCandidate {
  return {
    tier: "tier2_icp",
    companyName: company.companyName,
    domain: company.domain,
    role: company.role,
    boothOrSession: company.boothOrSession,
    fitScore,
    confidence: company.confidence,
    eventCompanyId: company._id,
    evidence: {
      sourceDocumentId: company.sourceDocumentId,
      sourceUrl: company.sourceUrl,
      quote: company.quote,
      factType: roleToFactType(company.role),
      confidence: company.confidence,
    },
  };
}

function roleToFactType(
  role: EventCompanyLite["role"],
): "exhibitor" | "sponsor" | "speaker" | "unknown" {
  if (role === "exhibitor" || role === "sponsor" || role === "speaker") {
    return role;
  }
  return "unknown";
}

function rankMatches(matches: MatchCandidate[]): MatchCandidate[] {
  const tierRank = (tier: MatchCandidate["tier"]) =>
    tier === "tier1_crm" ? 0 : 1;
  const typeRank = (match: MatchCandidate) => {
    if (match.matchedOppValue) return 0;
    if (match.tier === "tier1_crm") return 1;
    return 2;
  };

  return [...matches].sort((a, b) => {
    const tierDiff = tierRank(a.tier) - tierRank(b.tier);
    if (tierDiff !== 0) return tierDiff;
    const typeDiff = typeRank(a) - typeRank(b);
    if (typeDiff !== 0) return typeDiff;
    return b.fitScore - a.fitScore;
  });
}
