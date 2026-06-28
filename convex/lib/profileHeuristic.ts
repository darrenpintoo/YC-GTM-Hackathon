import type { RevenueProfileOutput } from "../../lib/aiSchemas";
import type { CsvRow } from "./csvParse";
import { parseOptionalNumber } from "./csvParse";

export function buildProfileHeuristic(
  rows: CsvRow[],
  profileName: string,
): RevenueProfileOutput & { name: string } {
  const industries = topValues(rows, "industry", 5);
  const buyerTitles = topValues(rows, "buyer_title", 6);
  const geographies = topValues(rows, "region", 5);
  const keywords = ["jobsite safety", "OSHA compliance", "field operations"];

  const dealSizes = rows
    .map((row) => parseOptionalNumber(row.deal_size))
    .filter((value): value is number => value !== undefined);

  const dealSizeClusters = bucketDealSizes(dealSizes);

  const closedWon = rows.filter((row) => row.account_type === "closed_won");
  const closedWonPatterns =
    closedWon.length > 0
      ? [
          `Wins cluster in ${topValues(closedWon, "industry", 2).join(" and ") || "core verticals"}.`,
          `Typical buyer titles: ${topValues(closedWon, "buyer_title", 2).join(", ") || "operations and safety leaders"}.`,
        ]
      : ["Insufficient closed-won history — using target account signals."];

  return {
    name: profileName,
    industries,
    buyerTitles,
    dealSizeClusters,
    geographies,
    keywords,
    closedWonPatterns,
    summary: `${profileName} sells into ${industries.slice(0, 2).join(" and ") || "construction and industrial"} accounts with ${buyerTitles.slice(0, 2).join(" / ") || "safety leadership"} buyers.`,
  };
}

function topValues(rows: CsvRow[], key: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key]?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function bucketDealSizes(values: number[]) {
  if (values.length === 0) {
    return [{ label: "Mid-market", min: 40000, max: 120000, count: 0 }];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const mid = sorted[Math.floor(sorted.length / 2)] ?? min;

  return [
    {
      label: "Core ACV band",
      min: Math.floor(min),
      max: Math.ceil(max),
      count: values.length,
    },
    {
      label: "Median deal",
      min: Math.floor(mid * 0.8),
      max: Math.ceil(mid * 1.2),
      count: Math.max(1, Math.floor(values.length / 2)),
    },
  ];
}

export function mapAccountType(
  value: string | undefined,
): "closed_won" | "open_opp" | "target" | "other" {
  switch (value?.toLowerCase()) {
    case "closed_won":
      return "closed_won";
    case "open_opp":
      return "open_opp";
    case "target":
      return "target";
    default:
      return "other";
  }
}
