# Schrute AI

**Before you buy the booth, know if your buyers are actually there.**

Schrute AI connects your CRM to an event's public footprint (exhibitors, sponsors, speakers, sessions), tells you which of *your* accounts have **confirmed public presence**, scores the **sponsor / attend / skip** decision with break-even math, and turns the matched accounts into pre-event outreach targets.

It is CRM-grounded, evidence-cited, and honest: it proves a *company* is present - never that a named person will attend - and it will tell you to **skip** when the evidence doesn't support the spend.

> Built for the **Y Combinator's AI Growth Hackathon** and placed #4 overall.

Pitch Video: https://www.youtube.com/watch?v=ZryCRmtFqCs \
Hosted URL: https://schrute-gtm.vercel.app/

---

## The proof (verified, on real data)

| Event | Matches | Open pipeline | Verdict |
| --- | --- | --- | --- |
| **ASSP Safety 2026** (real speaker/sponsor data) | 7 Tier-1 + 1 Tier-2 | $350K (2 open opps) | **Sponsor** (cap ~$32K, break-even 7 meetings) |
| **World of Concrete** (real supplier control) | 0 | - | **Skip** |

The skip result is the point: same CRM, different event, and Schrute AI refuses to invent matches that the public evidence doesn't support. The first version of this demo was rigged (the exhibitor list and CRM shared identical names); we threw it out, pulled *real* event data, and rebuilt the matcher to survive it.

---

## How it works

```
CRM CSV ──▶ Revenue Profile  ─┐
                              ├─▶ Account Matcher ─▶ Underwriting ─▶ Go/No-Go Memo
Event source ──▶ Extract ─────┘   (Tier-1 + Tier-2)   (break-even)     (cited)
   (exhibitors/sponsors/speakers)        │
                                         └─▶ Enrichment sidecar (Fiber → contacts → outreach drafts)
```

1. **Revenue Profile** - upload a CRM CSV; OpenAI (with a deterministic fallback) infers who you actually win: industries, buyer titles, deal-size clusters, keywords.
2. **Ingest + extract** - drop in an event's public pages/snapshot; parse companies present with their role, booth/session, source URL, and a verbatim quote.
3. **Account Matcher** - match companies-present against the CRM in two tiers: **Tier-1** known accounts (open opps / targets / closed-won), **Tier-2** net-new ICP. Every match carries typed `evidence[]`.
4. **Underwriting** - deterministic break-even (cost, win-rate, capture-rate) → sponsor cap, required meetings, and a `sponsor / attend / skip` verdict anchored to *counted* matched pipeline.
5. **Memo** - a cited, opinionated go/no-go. Missing data returns `unknown`; it never hallucinates an attendee list.
6. **Enrichment sidecar** (parallel, optional) - Fiber resolves decision-makers + verified contacts and drafts outreach. The core spine never blocks on it.

---

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | **Next.js 15** (App Router, Turbopack), **React 19**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui** (Radix primitives, lucide-react, sonner) |
| Backend / DB / orchestration | **Convex** - reactive DB, queries, mutations, and actions that orchestrate the pipeline and stream progress |
| AI extraction & memo | **OpenAI API**, called from Convex actions - with **deterministic heuristic fallbacks** so the whole spine runs with no API keys |
| Contact enrichment (sidecar) | **Fiber AI** - company resolution → decision-makers → verified emails/phones |
| Matching | Custom - corporate-suffix/stopword normalization, **edit-distance-blended fuzzy matching**, domain-root signals, duplicate suppression |

---

## Run it locally

```bash
npm install
npx convex dev            # provisions a deployment, generates types, watches functions
npm run dev               # Next.js app → http://localhost:3000  (separate terminal)
```

Drive the pipeline headless (no API keys required - uses heuristic fallbacks):

```bash
npx convex run orchestrate:seedDemo        # ASSP Safety 2026 → 7 Tier-1, $350K, "sponsor"
npx convex run orchestrate:seedSkipDemo    # WOC supplier control → 0 matches, "skip"
npx convex run debug:dumpDemo              # print matches + score + memo
npx convex run orchestrate:resetDemo       # clean slate (idempotent re-seed)
```

Optional: set `OPENAI_API_KEY` (richer extraction + memo) and `FIBER_API_KEY` (live enrichment) in the Convex dashboard. Without them, the deterministic path still produces the full decision.

---

## Project structure

```
app/                         Next.js App Router UI (board, drawer, memo)
convex/
  schema.ts                  data model (profiles, accounts, events, matches, scores, memos, jobs)
  contracts.ts               typed API surface the frontend builds against
  profile.ts                 CSV → Revenue Profile
  ingest.ts                  source ingestion + extraction
  matcher.ts                 Tier-1 + Tier-2 matching entrypoint
  underwrite.ts              break-even + verdict
  memo.ts                    cited go/no-go memo
  orchestrate.ts             seedDemo / seedSkipDemo / resetDemo / core pipeline
  pipeline.ts                ingest → match → score → memo spine
  debug.ts                   headless dump/inspection queries
  lib/                       matching, normalize, extract, underwriting, openai, csv, defaults
lib/                         shared types, mocks, resolveCompany interface
data/
  safesite_crm.csv           demo CRM (SafeSite OS, a safety-software seller)
  source_packs/              real cached event evidence (ASSP Safety 2026, WOC control)
```

---

## What's real vs. in progress

- **Live & verified:** the full decision spine - CRM → profile → ingest → match → underwrite → memo - on real ASSP/WOC data, runnable headless and deterministic.
- **Built:** Next.js + shadcn/ui surface wired to Convex reactive queries.
- **Sidecar (activation layer):** Fiber enrichment + outreach drafting sit behind a stable `accountMatch` interface and run as an optional parallel step - the core verdict never depends on them.

---

## Team

- **Kathan Gabani**
- **Darren Pinto**
- **Nehal Agrawal**
