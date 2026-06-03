# Pathfinder

[![CI](https://github.com/OfirCS/wealtyh/actions/workflows/ci.yml/badge.svg)](https://github.com/OfirCS/wealtyh/actions/workflows/ci.yml)
[![Deploy](https://github.com/OfirCS/wealtyh/actions/workflows/deploy.yml/badge.svg)](https://github.com/OfirCS/wealtyh/actions/workflows/deploy.yml)
![Evals](https://img.shields.io/badge/AI%20evals-6%2F6%20passing-2b7a42)

A free, AI-powered Canadian life-decision planner. Type a life event (having a baby, buying a home, taking a career break) plus your real numbers, and get back a concrete plan with TFSA/RRSP/FHSA awareness, live data via search grounding, and a shareable link.

- **Live:** https://pathfinder.fyi (when deployed)
- **GitHub Pages demo:** https://ofircs.github.io/wealtyh/ — pre-recorded AI responses for "having a baby", "buying a home", "career break". For the real Claude + Gemini pipeline, run locally with `npm run dev`.

> It is an educational tool — no real money moves. No bank integration, no auth, no signup.

---

## The interesting part: the AI proposes, deterministic code disposes

The hard problem with an LLM giving financial advice isn't generating plausible text — it's making sure every dollar is **real**, every action is **possible**, and every suggestion is **relevant** to what the user actually asked. Pathfinder treats the model as a *proposer* and puts a deterministic engine in charge of *disposing*:

```
User Input (life event + financial profile)
        │
        ▼
   1. Router    (Claude Haiku → Gemini)        ── "would live data change the dollar amounts?"
        │
   2. Search    (Gemini + Google grounding)    ── fetches current rates / costs, with sources
        │
   3. Generate  (Claude Sonnet → Gemini)        ── drafts a full structured plan as JSON
        │
   4. Guardrails (pure TypeScript, no model)    ── re-derives every number from the user's real balances
        │
        ▼
   Plan view  +  reasoning trace  +  shareable URL
```

Every provider call has a **Claude → Gemini fallback** (`callAI` in `src/lib/pathfinder-engine.ts`), so the app degrades gracefully if one provider is down.

### The guardrail layer is where the engineering lives

After the model returns JSON, `applyPostParseGuardrails()` (`src/lib/pathfinder-engine.ts`) never trusts a single number it produced. It:

- runs a **mutable balance ledger** — each action's cost is deducted so later actions only see the *remaining* balance, with a $500 chequing floor;
- runs a **room ledger** for registered accounts (TFSA/RRSP/FHSA/RESP) and caps deposits to real contribution room;
- enforces **eligibility** — strips an FHSA deposit for someone who already owns a home, a credit-card pay-off when there's no balance, an automation the surplus can't sustain;
- **smart-splits** a move that's too big into a lump sum + a follow-up automation for the shortfall;
- **rebuilds** `account_impacts`, `monthly_cashflow`, and the net-worth summary from the user's actual balances + the validated actions, so the displayed math always ties out;
- runs a **relevance filter** over the model's chain-of-thought (`filterThinkingSteps`) that removes generic profile audits ("Cash Flow Analysis") and reasoning about goals the user is *abandoning* ("done with buying a house" → drop the down-payment steps, keep the FHSA-withdrawal-tax step);
- applies a **complexity-based action cap** (simple → 2, moderate → 4, multi-goal → up to 7).

## How we measure quality — evals

The most credible way to show the guardrails work is to **measure** them. `evals/` is a deterministic eval harness that replays **recorded raw model responses** (some deliberately wrong) through the real `parse → guardrails` pipeline and scores invariants. It calls **no live model**, so it runs in CI with **no API keys**.

```bash
npm run eval
```

Current scorecard ([full results](./evals/RESULTS.md), [methodology](./evals/README.md)):

| Metric | Pass rate |
| --- | --- |
| `balance_room_safety` — no action exceeds source balance or registered room | 6/6 |
| `relevance_filter` — surviving reasoning is on-topic, abandoned goals stripped | 6/6 |
| `math_consistency` — cashflow, balances & net-worth tie to real numbers | 6/6 |
| `eligibility_removals` — impossible/ineligible actions removed for the right reason | 6/6 |
| `action_count_discipline` — plan respects the complexity-based cap | 6/6 |

A regression in the guardrails turns the eval — and CI — red.

## See it reason

The plan view's **"How Pathfinder reasoned"** panel surfaces the actual decision trace, not a marketing summary: the router's decision *and its reasoning*, the search queries + sources it grounded on, how many actions it drafted, and exactly which suggestions were **capped or removed** against your real balances (e.g. _"Max FHSA $8,000 — not a home-buying event"_). It makes the "propose / dispose" split visible in the product itself. The `/backend-flow` page renders the same pipeline as an interactive diagram.

---

## Stack & cost

- Next.js 16 + TypeScript (strict) + Tailwind v4, deployed on Vercel
- Claude (`@anthropic-ai/sdk`) + Gemini (`@google/genai`) for the AI pipeline
- In-memory IP rate limit (default: 20 plans/IP/day, 1000 plans/day globally)
- Cost in production: free Vercel + ~$0.003 per Claude plan call. With the default cap of 1000/day ≈ ~$3/day worst case.

## Run locally

```bash
npm install
cp .env.example .env   # add your keys
npm run dev            # http://localhost:3003
```

## Tests, types & evals

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # unit + eval suites (no API keys needed)
npm run eval        # AI eval scorecard → evals/RESULTS.md
npm run test:e2e    # Playwright end-to-end (mock-driven)
```

CI (`.github/workflows/ci.yml`) runs typecheck + lint + unit tests + evals on every push and PR — all **without API keys** (71 checks green, plus a 6-scenario eval suite). Live-AI integration tests are gated behind `GOOGLE_API_KEY` and skip automatically when it's absent.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import in Vercel.
3. Set environment variables (see `.env.example`).
4. Deploy. The in-memory rate limiter works on Vercel without any other infra.

For traffic over a few hundred plans/day, swap `src/lib/rate-limit.ts` for Upstash KV.

## Sponsor / ads

To enable a sponsor slot, set in Vercel:

```
NEXT_PUBLIC_SPONSOR_NAME="Sponsor name"
NEXT_PUBLIC_SPONSOR_PITCH="One-line pitch (max ~120 chars)"
NEXT_PUBLIC_SPONSOR_URL="https://sponsor.example.com"
```

If any are missing, the slot shows "Ad slot available" with a mailto link.
