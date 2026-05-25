# Pathfinder

A free, AI-powered Canadian life-decision planner. Type a life event (having a baby, buying a home, taking a career break) plus your real numbers, get back a concrete plan with TFSA/RRSP/FHSA awareness, live data via search grounding, and a shareable link.

Live: https://pathfinder.fyi (when deployed)
GitHub Pages showcase: https://ofircs.github.io/wealtyh/ — pre-recorded AI responses for "having a baby", "buying a home", "career break". For the real Claude+Gemini pipeline, run locally with `npm run dev`.

## What it does

- Takes a life event + your financial snapshot
- Routes through a 3-step agentic AI pipeline (Claude Sonnet primary, Gemini fallback, Google Search grounding for live rates/costs)
- Outputs concrete next steps, impact analysis, monthly cashflow, and risk warnings
- Encodes the entire scenario into a shareable URL (no DB needed)

It is an educational tool — no real money moves. There is no bank integration, no auth, no signup.

## Stack & cost

- Next.js 16 + TypeScript + Tailwind, deployed on Vercel
- Claude (`@anthropic-ai/sdk`) + Gemini (`@google/genai`) for the AI pipeline
- In-memory IP rate limit (default: 20 plans/IP/day, 1000 plans/day globally)
- Sponsor slot in the sidebar — env-var driven, falls back to a "this slot available" placeholder
- Cost in production: free Vercel + ~$0.003 per Claude plan call. With the default cap of 1000/day = ~$3/day worst case.

## Run locally

```bash
npm install
cp .env.example .env   # add your keys
npm run dev            # http://localhost:3003
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import in Vercel.
3. Set environment variables (see `.env.example`).
4. Deploy. That's it — the in-memory rate limiter works on Vercel without any other infra.

For traffic over a few hundred plans/day, swap `src/lib/rate-limit.ts` for Upstash KV.

## Sponsor / ads

To enable a sponsor slot, set in Vercel:

```
NEXT_PUBLIC_SPONSOR_NAME="Sponsor name"
NEXT_PUBLIC_SPONSOR_PITCH="One-line pitch (max ~120 chars)"
NEXT_PUBLIC_SPONSOR_URL="https://sponsor.example.com"
```

If any are missing, the slot shows "Ad slot available" with a mailto link.

## Architecture

```
User Input (life event + financial profile)
        │
        ▼
   Router (Claude Haiku → Gemini)   ── decides: search needed?
        │
   Search (Gemini + Google grounding) ── fetches live rates/costs
        │
   Generate (Claude Sonnet → Gemini)  ── full structured plan
        │
   Guardrails                         ── strip hallucinated $ / impossible actions
        │
        ▼
   Plan view + shareable URL
```

The AI never moves money. Every step is read-only suggestion — the human decides what to do.

## Tests

```bash
npm run test
```

52 unit + 15 integration tests cover the financial engine, state machine, and AI pipeline.
