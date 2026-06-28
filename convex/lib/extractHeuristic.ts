export type ExtractedCompany = {
  companyName: string;
  role: "exhibitor" | "sponsor" | "speaker" | "unknown";
  boothOrSession: string;
  quote: string;
  confidence: number;
};

const BOOTH_LINE =
  /^(.+?)\s*[—–-]\s*(?:Booth\s+)?([A-Za-z0-9]+)\s*$/i;
const SPONSOR_LINE = /^(.+?)\s*[—–-]\s*(Gold|Silver|Bronze|Platinum)?\s*Sponsor\s*$/i;

/** Heuristic exhibitor-list parser when OpenAI is unavailable. */
export function extractCompaniesHeuristic(text: string): ExtractedCompany[] {
  const companies: ExtractedCompany[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Note:")) continue;

    let     match = line.match(BOOTH_LINE);
    if (match?.[1] && match[2]) {
      const companyName = match[1].trim();
      const booth = match[2].trim();
      const key = companyName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      companies.push({
        companyName,
        role: "exhibitor",
        boothOrSession: booth,
        quote: line,
        confidence: 0.9,
      });
      continue;
    }

    match = line.match(SPONSOR_LINE);
    if (match?.[1]) {
      const companyName = match[1].trim();
      const key = companyName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      companies.push({
        companyName,
        role: "sponsor",
        boothOrSession: `${match[2] ?? ""} Sponsor`.trim(),
        quote: line,
        confidence: 0.88,
      });
    }
  }

  return companies;
}
