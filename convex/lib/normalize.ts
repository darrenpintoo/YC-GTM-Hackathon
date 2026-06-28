export function normalizeCompanyName(name: string): string {
  return companyTokens(name).join(" ");
}

export function companyTokens(name: string): string[] {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !NOISE_TOKENS.has(token));
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

export function domainMatchesCompanyName(
  domain: string | undefined,
  companyName: string,
): boolean {
  const root = domainRoot(domain);
  if (!root) return false;

  const tokens = companyTokens(companyName);
  if (tokens.includes(root)) return true;
  if (tokens.join("").includes(root)) return true;

  return fuzzyNameScore(root, companyName) >= 0.9;
}

export function fuzzyNameScore(a: string, b: string): number {
  const normalizedA = normalizeCompanyName(a);
  const normalizedB = normalizeCompanyName(b);

  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  if (containsWholeName(normalizedA, normalizedB)) {
    return 0.92;
  }

  const tokensA = new Set(normalizedA.split(" "));
  const tokensB = new Set(normalizedB.split(" "));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }

  const tokenScore = (2 * overlap) / (tokensA.size + tokensB.size);
  const editScore =
    1 -
    damerauLevenshtein(normalizedA, normalizedB) /
      Math.max(normalizedA.length, normalizedB.length);

  const acronymScore = acronymScoreFor(tokensA, tokensB);
  return Math.max(acronymScore, tokenScore * 0.72 + editScore * 0.28);
}

function domainRoot(domain: string | undefined): string | undefined {
  const normalized = normalizeDomain(domain);
  if (!normalized) return undefined;

  const hostParts = normalized.split(".");
  const root = hostParts.length >= 2 ? hostParts[hostParts.length - 2] : hostParts[0];
  return root?.replace(/[^a-z0-9]/g, "") || undefined;
}

function containsWholeName(a: string, b: string): boolean {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return longer.split(" ").includes(shorter) || longer.startsWith(`${shorter} `);
}

function acronymScoreFor(tokensA: Set<string>, tokensB: Set<string>): number {
  const acronymA = acronymForTokens([...tokensA]);
  const acronymB = acronymForTokens([...tokensB]);
  if (acronymA && acronymA === acronymB) return 0.95;
  if (tokensA.has(acronymB) || tokensB.has(acronymA)) return 0.9;
  return 0;
}

function acronymForTokens(tokens: string[]): string {
  if (tokens.length <= 1) return "";
  return tokens.map((token) => token.charAt(0)).join("");
}

function damerauLevenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    dp[i]![0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    dp[0]![j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    const row = dp[i]!;
    const prevRow = dp[i - 1]!;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        prevRow[j]! + 1,
        row[j - 1]! + 1,
        prevRow[j - 1]! + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        row[j] = Math.min(row[j]!, dp[i - 2]![j - 2]! + cost);
      }
    }
  }

  return dp[a.length]![b.length]!;
}

const NOISE_TOKENS = new Set([
  "a",
  "an",
  "and",
  "the",
  "us",
  "usa",
  "inc",
  "incorporated",
  "llc",
  "co",
  "company",
  "corp",
  "corporation",
  "limited",
  "ltd",
  "lp",
  "llp",
  "plc",
  "group",
  "builders",
  "building",
]);
