export type ExtractedCompany = {
  companyName: string;
  role: "exhibitor" | "sponsor" | "speaker" | "unknown";
  boothOrSession: string;
  quote: string;
  confidence: number;
};

const BOOTH_LINE =
  /^(.+?)\s*[-\u2013\u2014]\s*Booth\s*#?\s*([A-Za-z0-9]+)\s*$/i;
const SPONSOR_LINE =
  /^(.+?)\s*[-\u2013\u2014]\s*(Gold|Silver|Bronze|Platinum)?\s*Sponsor\s*$/i;
const SPONSORED_BY_LINE = /^Sponsored by\s+(.+?)\s*$/i;
const STRUCTURED_ROLE_LINE =
  /^(.+?)\s*[-\u2013\u2014]\s*(Speaker|Sponsor)\s*[-\u2013\u2014]\s*(.+)$/i;
const SPEAKER_ORG_HTML = /<p>([^<]+)<br>([^<]+)<\/p>/gi;

/** Heuristic exhibitor/sponsor/speaker parser when OpenAI is unavailable. */
export function extractCompaniesHeuristic(text: string): ExtractedCompany[] {
  const companies: ExtractedCompany[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = plainText(rawLine);
    if (!line || line.startsWith("Note:")) continue;

    let match = line.match(BOOTH_LINE);
    if (match?.[1] && match[2]) {
      pushCompany(companies, seen, {
        companyName: match[1].trim(),
        role: "exhibitor",
        boothOrSession: match[2].trim(),
        quote: line,
        confidence: 0.9,
      });
      continue;
    }

    match = line.match(SPONSOR_LINE);
    if (match?.[1]) {
      pushCompany(companies, seen, {
        companyName: match[1].trim(),
        role: "sponsor",
        boothOrSession: `${match[2] ?? ""} Sponsor`.trim(),
        quote: line,
        confidence: 0.88,
      });
      continue;
    }

    match = line.match(SPONSORED_BY_LINE);
    if (match?.[1]) {
      pushCompany(companies, seen, {
        companyName: firstSponsorName(match[1]),
        role: "sponsor",
        boothOrSession: "Sponsored session",
        quote: line,
        confidence: 0.88,
      });
      continue;
    }

    match = line.match(STRUCTURED_ROLE_LINE);
    if (match?.[1] && match[2] && match[3]) {
      const role = match[2].toLowerCase() === "speaker" ? "speaker" : "sponsor";
      pushCompany(companies, seen, {
        companyName: match[1].trim(),
        role,
        boothOrSession: match[3].trim(),
        quote: line,
        confidence: role === "speaker" ? 0.86 : 0.88,
      });
      continue;
    }

    if (rawLine.includes("<h4>Speaker(s)</h4>")) {
      for (const speakerMatch of rawLine.matchAll(SPEAKER_ORG_HTML)) {
        const companyName = plainText(speakerMatch[1] ?? "");
        const title = plainText(speakerMatch[2] ?? "");
        if (!companyName) continue;
        pushCompany(companies, seen, {
          companyName,
          role: "speaker",
          boothOrSession: title || "Speaker",
          quote: line,
          confidence: 0.86,
        });
      }
    }
  }

  return companies;
}

function pushCompany(
  companies: ExtractedCompany[],
  seen: Set<string>,
  company: ExtractedCompany,
) {
  const key = `${company.role}:${company.companyName.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  companies.push(company);
}

function plainText(line: string): string {
  return line
    .trim()
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "-")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

function firstSponsorName(value: string): string {
  return value
    .replace(/\s+and\s+the\s+.+$/i, "")
    .replace(/\s+and\s+.+Practice Specialty.*$/i, "")
    .trim();
}
