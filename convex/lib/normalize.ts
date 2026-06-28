export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

/** Simple token overlap ratio for fuzzy name matching. */
export function fuzzyNameScore(a: string, b: string): number {
  const tokensA = new Set(normalizeCompanyName(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeCompanyName(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}
