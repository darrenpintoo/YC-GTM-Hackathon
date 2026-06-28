import type { ResolvedCompany } from "./types";

const DOMAIN_HINTS: Record<string, string> = {
  "turner construction": "turnerconstruction.com",
  "skanska usa": "usa.skanska.com",
  "clark construction": "clarkconstruction.com",
  mortenson: "mortenson.com",
  "the haskell company": "haskell.com",
  "brasfield & gorrie": "brasfieldgorrie.com",
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Lightweight company resolution — domain lookup + fuzzy name hints.
 * Nehal can swap Fiber resolution behind the same interface.
 */
export async function resolveCompany(
  companyName: string,
  hints?: { domain?: string },
): Promise<ResolvedCompany> {
  const normalized = normalizeName(companyName);

  if (hints?.domain) {
    return {
      companyName,
      domain: hints.domain,
      confidence: 0.95,
      source: "domain_lookup",
    };
  }

  const hintedDomain = DOMAIN_HINTS[normalized];
  if (hintedDomain) {
    return {
      companyName,
      domain: hintedDomain,
      confidence: 0.85,
      source: "fuzzy_name",
    };
  }

  return {
    companyName,
    confidence: 0.4,
    source: "unknown",
  };
}
