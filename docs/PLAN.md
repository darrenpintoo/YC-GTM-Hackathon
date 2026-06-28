# Schrute AI — Build Plan (Hackathon MVP)

> Evidence-first event intelligence. The hero is the **Event Signal Graph**:
> paste an event → agentic research surfaces the *real companies* present →
> an elegant, expandable UI ranks the ones that actually match your pipeline →
> a blunt, evidence-backed Go / No-Go memo.

## 0. Strategic frame (why this wins the room)

- **Evidence is the hero, not the score.** Judges are skeptical of predicted ROI.
  So we lead with *verifiable, cited, named* findings ("47 companies found →
  9 match your closed-won lookalikes, here they are with sources"). The number
  is the closer, not the pitch.
- **Demo on events the judges recognize** (SaaStr, INBOUND, Dreamforce) so they
  can sanity-check the evidence in real time — *then* flip to the industrial
  wedge (World of Concrete, NSC Safety Congress) to show the engine works when
  attendee lists are hidden. Same engine, two worlds.
- **Bulletproof live demo.** OpenAI powers research when a key is present; a
  curated real-data fallback guarantees the demo never dies on stage.
- **Sponsor alignment:** OpenAI (extraction/scoring/memo) + Convex (reactive
  store) — both have judges in the room.

## 1. Scope

### MVP (tonight → Sun AM)
- [ ] Design system: dark, premium "intelligence terminal" aesthetic
- [ ] Dashboard: ranked event board + revenue-profile summary + "Analyze event"
- [ ] **Event detail (HERO):** Signal Graph, expandable company evidence,
      sub-score breakdown, Go/No-Go memo
- [ ] Two seeded workspaces: GTM-SaaS (judge-resonant) + Industrial (the wedge)
- [ ] Analyze flow with live "agent researching" animation
- [ ] Scoring engine (deterministic math + AI rationale)
- [ ] Curated demo dataset (real events, real recognizable companies)

### V1.5 (Sun midday, if time)
- [ ] Real OpenAI extraction from a pasted event URL / content
- [ ] CRM CSV upload → Revenue Profile extraction
- [ ] Convex persistence (workspaces, events, signals, memos)
- [ ] Memo export / shareable report
- [ ] Deploy to Vercel + open-source README

### Cut for now
- Salesforce/HubSpot live integrations, auto event discovery, portfolio planner.

## 2. Architecture

```
Next.js 16 (App Router, RSC) ── UI ──────────────────────────────┐
   src/app            pages + route handlers                      │
   src/components     design system + feature components          │
   src/lib            types, scoring engine, demo data, cn        │
                                                                  │
/api/analyze (route handler) ── OpenAI (extract+score+memo) ──────┤
                              └─ fallback: curated dataset         │
Convex (V1.5) ── workspaces / events / signals / scores / memos ──┘
```

- **Frontend:** Next 16, React 19, Tailwind v4 (CSS theme tokens), `motion`
  for animation, `lucide-react` icons, Geist Sans/Mono.
- **AI:** `openai` SDK. Structured outputs (JSON schema) for entity extraction,
  ICP matching rationale, sub-score justification, memo generation.
- **State:** local demo store now; Convex adapter slotted behind a data layer.

## 3. Core data model

```ts
Workspace { id, name, revenueProfile }
RevenueProfile {
  company, bestFitIndustries[], buyerPersonas[], dealSizeBand,
  geographies[], closedWonLookalikes[] (company names), keywords[], eventGoal
}
EventEval {
  id, name, url, location, date, category, costEstimate,
  signals: EventSignal[], score: EventScore, memo: DecisionMemo, status
}
EventSignal {
  id, type: 'attendee'|'company-presence'|'historical'|'social'|'icp-proxy',
  source (url), evidence (text), company?, role?, matchToICP (0-1), confidence (0-1)
}
EventScore {
  total, icpFit, accountSignal, buyerDensity, pipelineUpside,
  costRisk, evidenceConfidence
}
DecisionMemo {
  verdict: 'attend'|'sponsor'|'reps-only'|'maybe'|'skip',
  headline, rationale, sponsorThreshold?, successCriteria, missingData[], nextAction
}
```

## 4. Scoring engine (deterministic + explainable)

Weighted (matches PRD): ICP Fit 30 · Account Signal 25 · Buyer Density 15 ·
Pipeline Upside 15 · Cost Risk 10 · Evidence Confidence 5 → **Schrute Score /100**.

- Each sub-score derived from signals (counts, match strength, confidence).
- **Confidence ≠ fit:** high-fit + low-evidence renders as "promising but
  uncertain" — shown explicitly, never hidden.
- Verdict thresholds map score + confidence → recommendation.
- AI writes the *rationale*; the *number* is deterministic and adjustable.

## 5. The hero screen (Event detail) — what makes it look great

1. **Header:** event name, date/location, big animated **Schrute Score** gauge,
   verdict pill (Attend / Skip…), confidence meter.
2. **Signal Graph:** the "47 companies found" moment — animated count-up,
   signal-type breakdown bars, then an **expandable list of real companies**,
   each row: logo/initial, name, why-it-matches chip ("looks like {closed-won}"),
   match strength bar, source link. Sort by pertinence. Filter by signal type.
3. **Sub-score breakdown:** six animated bars with one-line explanations.
4. **Go / No-Go Memo:** blunt headline + rationale + sponsorship threshold +
   success criteria + missing data + next action. Copy/share.

Aesthetic: deep near-black canvas, subtle borders, mono for data/counts/sources,
emerald→lime "signal" accent, semantic verdict colors (emerald/amber/rose),
tasteful motion (count-ups, staggered reveals, expand transitions).

## 6. Demo script (45–60s)
1. "Everyone here spends on events on vibes and sponsor decks."
2. Dashboard: three events ranked by Schrute Score for *your* pipeline.
3. Open the top event → Signal Graph counts up → expand the matched companies →
   "these 9 look exactly like your closed-won accounts, here are the sources."
4. Read the blunt memo: "Attend. Don't sponsor over $14K. 6 qualified meetings
   to break even."
5. Flip workspace to the industrial event (no attendee list) → same engine,
   proxy evidence. "We don't need the list. We infer the room."

## 7. Timeline
- **Sat night:** scaffold ✓ · design system · demo data · dashboard · hero screen
- **Late night:** scoring engine · analyze animation · polish
- **Sun AM:** OpenAI extraction · CRM upload · Convex
- **Sun midday:** curate demo data · deploy · README · rehearse
- **Buffer** before 5pm judging.

## 8. Risks & mitigations
- *Live research flakiness* → curated fallback always on.
- *"It's a GPT wrapper"* → named, sourced evidence + deterministic score + CRM match.
- *Vertical doesn't resonate* → lead with SaaS events the judges know.
- *Convex login friction* → app fully works on local data layer; Convex is additive.
