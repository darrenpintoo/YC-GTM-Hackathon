export type ExtractedCompany = {
  companyName: string;
  role: "exhibitor" | "sponsor" | "speaker" | "unknown";
  boothOrSession: string;
  quote: string;
  confidence: number;
};

export type HeuristicExtractionResult = {
  companies: ExtractedCompany[];
  coverage: number;
  parseableLines: number;
  parsedLines: number;
};

const BOOTH_LINE =
  /^(.+?)\s*[—–-]\s*(?:Booth\s+)?([A-Za-z0-9]+)\s*$/i;
const SPONSOR_LINE =
  /^(.+?)\s*[—–-]\s*(Gold|Silver|Bronze|Platinum)?\s*Sponsor\s*$/i;
const BULLET_LINE = /^[\s]*[-*•]\s+(.+)$/;
const PIPE_LINE = /^(.+?)\s*\|\s*(.+)$/;
const SPEAKER_LINE =
  /^([A-Z][a-zA-Z.'\-\s]+),\s*(.+?),\s*(.+)$/;

function isParseableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("Note:")) return false;
  if (trimmed.length < 3 || trimmed.length > 200) return false;
  return (
    BOOTH_LINE.test(trimmed) ||
    SPONSOR_LINE.test(trimmed) ||
    BULLET_LINE.test(trimmed) ||
    PIPE_LINE.test(trimmed) ||
    SPEAKER_LINE.test(trimmed) ||
    /^[A-Z][a-zA-Z0-9&.'\-\s]{2,60}(,\s*[A-Z])/.test(trimmed)
  );
}

function parseLine(line: string, seen: Set<string>): ExtractedCompany | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let match = trimmed.match(BOOTH_LINE);
  if (match?.[1] && match[2]) {
    const companyName = match[1].trim();
    const key = companyName.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      companyName,
      role: "exhibitor",
      boothOrSession: match[2].trim(),
      quote: trimmed,
      confidence: 0.9,
    };
  }

  match = trimmed.match(SPONSOR_LINE);
  if (match?.[1]) {
    const companyName = match[1].trim();
    const key = companyName.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      companyName,
      role: "sponsor",
      boothOrSession: `${match[2] ?? ""} Sponsor`.trim(),
      quote: trimmed,
      confidence: 0.88,
    };
  }

  match = trimmed.match(PIPE_LINE);
  if (match?.[1] && match[2]) {
    const companyName = match[1].trim();
    const booth = match[2].trim();
    if (companyName.length >= 2 && booth.length <= 20) {
      const key = companyName.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        companyName,
        role: "exhibitor",
        boothOrSession: booth,
        quote: trimmed,
        confidence: 0.85,
      };
    }
  }

  match = trimmed.match(SPEAKER_LINE);
  if (match?.[1] && match[2] && match[3]) {
    const companyName = match[3].trim();
    const key = companyName.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      companyName,
      role: "speaker",
      boothOrSession: match[2].trim(),
      quote: trimmed,
      confidence: 0.82,
    };
  }

  match = trimmed.match(BULLET_LINE);
  if (match?.[1]) {
    const raw = match[1].trim();
    const companyName = raw.split(/[—–-]/)[0]?.trim() ?? raw;
    if (companyName.length >= 2 && companyName.length <= 80) {
      const key = companyName.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const role = /sponsor/i.test(raw)
        ? "sponsor"
        : /speaker|keynote/i.test(raw)
          ? "speaker"
          : "exhibitor";
      return {
        companyName,
        role,
        boothOrSession: "unknown",
        quote: trimmed,
        confidence: 0.75,
      };
    }
  }

  return null;
}

/** Heuristic exhibitor-list parser when OpenAI is unavailable. */
export function extractCompaniesHeuristic(text: string): ExtractedCompany[] {
  return extractCompaniesHeuristicWithCoverage(text).companies;
}

/** Heuristic parser with coverage metric for hybrid silver routing. */
export function extractCompaniesHeuristicWithCoverage(
  text: string,
): HeuristicExtractionResult {
  const companies: ExtractedCompany[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  let parseableLines = 0;
  let parsedLines = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Note:")) continue;
    if (isParseableLine(line)) parseableLines += 1;

    const parsed = parseLine(line, seen);
    if (parsed) {
      companies.push(parsed);
      parsedLines += 1;
    }
  }

  // Comma-separated exhibitor rows (single long line).
  if (companies.length < 5) {
    for (const rawLine of lines) {
      if (!rawLine.includes(",") || rawLine.length < 40) continue;
      const parts = rawLine.split(/,\s+/);
      if (parts.length < 4) continue;
      for (const part of parts) {
        const name = part.replace(/Booth\s+\S+/i, "").trim();
        if (name.length < 3 || name.length > 80) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        companies.push({
          companyName: name,
          role: /sponsor/i.test(part) ? "sponsor" : "exhibitor",
          boothOrSession: "unknown",
          quote: part,
          confidence: 0.7,
        });
        parsedLines += 1;
      }
      parseableLines += parts.length;
    }
  }

  const coverage =
    parseableLines > 0 ? Math.min(1, parsedLines / parseableLines) : 0;

  return { companies, coverage, parseableLines, parsedLines };
}
