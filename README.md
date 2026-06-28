# Schrute AI — Event Intelligence

> **Before you buy the booth, ask Schrute.**
> Evidence-first event intelligence for B2B GTM teams. Paste an event → Schrute
> researches the public evidence, surfaces the real companies in the room,
> matches them against your closed-won set, and returns a blunt Go / No-Go memo.

Built for the **YC AI Growth Hackathon** (Orange Slice), June 2026.

## Why

B2B teams spend $30K+ on booths, travel, and rep time on the strength of sponsor
decks and vibes. Schrute makes the **pre-spend** decision with evidence:

- **Evidence is the hero, not the score.** Every recommendation is backed by
  named, sourced companies you can verify — not an unexplained number.
- **Works when attendee lists are hidden.** Sponsors, exhibitors, speakers,
  agenda topics, social posts, and historical data become an _Event Signal Graph_.
- **Connected to your pipeline.** Signals are matched against your closed-won
  lookalikes, so "47 companies found" becomes "9 that look like who you win."

## What it does

1. **Revenue Profile** — infers who you actually win from CRM data.
2. **Event Signal Graph** — public proxy evidence that your buyers are present,
   with an elegant expandable UI: counts, signal-type breakdown, per-company
   match strength, and source links.
3. **Schrute Score** — a deterministic, explainable 0–100 score with six
   sub-scores (ICP Fit, Account Signal, Buyer Density, Pipeline Upside, Cost
   Risk, Evidence Confidence). _Confidence ≠ fit._
4. **Go / No-Go Memo** — a blunt, evidence-backed verdict with sponsorship cap,
   success criteria, expected pipeline, and the next action.

## Stack

- **Next.js 16** (App Router, RSC) · **React 19** · **TypeScript**
- **Tailwind v4** + custom design system · **motion** · **lucide-react**
- **OpenAI** for live research/extraction/memo (with a curated fallback so the
  demo never fails on stage)
- **Convex** (planned) for reactive persistence

## Run it

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

Optional, for live research:

```bash
export OPENAI_API_KEY=sk-...
```

Without a key, the app runs entirely on the curated demo dataset.

## Demo workspaces

- **Atlas Signals** (GTM SaaS) — SaaStr, Pavilion GTM Summit, INBOUND, Web Summit.
- **Sitewise** (industrial) — World of Concrete, NSC Safety Congress, CONEXPO —
  the "no attendee list" wedge, scored purely from proxy evidence.

## Project layout

```
src/app/                routes (dashboard, event detail, analyze, /api/analyze)
src/components/          design system + feature components (SignalGraph, etc.)
src/lib/types.ts         domain model
src/lib/score.ts         deterministic scoring engine
src/lib/demo-data.ts     curated workspaces, events & signals
docs/PRD.md              product spec
docs/PLAN.md             build plan
```
