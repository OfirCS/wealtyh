# Pathfinder

An AI-powered financial simulation engine for Wealthsimple that helps users reason through life's biggest financial decisions.

## What It Does

Pathfinder takes a life event ("Having a baby", "Buying a home", "Taking a career break") and your real financial profile, then produces:

- **Concrete actions** mapped to Wealthsimple operations (transfers, auto-deposits, account opens)
- **Impact analysis** showing income, expense, net worth, and timeline effects
- **Account projections** with current vs. projected balances
- **Monthly cashflow** breakdown across phases
- **Risk warnings** and advisor flags for edge cases

The AI suggests. The human confirms. Money never moves without explicit double-confirmation.

## Architecture

```
User Input (life event + financial profile)
        │
        ▼
┌─────────────────┐
│   Router Step    │  gemini-2.5-flash-lite
│  (needs search?) │  Decides if real-time data is needed
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Search   │  gemini-2.5-flash-lite + Google Search grounding
    │(optional) │  Fetches live rates, costs, regulations
    └────┬─────┘
         │
    ┌────▼─────────┐
    │   Generate    │  gemini-2.5-flash (temp=0.1)
    │  (full plan)  │  Structured financial plan with actions
    └──────────────┘
```

**Why 3 steps?** Cost optimization + accuracy. The cheap model handles routing and search. The capable model generates the plan. Search grounding prevents hallucinated mortgage rates and tax rules.

## Human/AI Boundary

| AI Does | Human Does |
|---------|------------|
| Analyze cascading financial impacts | Confirm each action with double-tap |
| Pull real-time data (rates, costs) | Decide which actions to take |
| Suggest concrete Wealthsimple actions | Review risk warnings before acting |
| Flag when to talk to an advisor | Choose to talk to an advisor or not |

The AI never moves money. Every financial action requires explicit user confirmation through a bottom-sheet with a double-confirm pattern.

## Tech Stack

- **Next.js 16** + TypeScript + Tailwind CSS
- **Framer Motion** for page transitions and micro-animations
- **Google Gemini** (`@google/genai`) for the AI pipeline
- **Vitest** for unit and integration testing
- Wealthsimple design tokens for consistent branding

## Run Locally

```bash
git clone <repo-url> && cd pathfinder
npm install
```

Create `.env` with your Google AI API key:

```
GOOGLE_API_KEY=your_key_here
```

```bash
npm run dev      # Start on http://localhost:3000
npm run test     # Run all tests (52 unit + 15 integration)
npm run build    # Production build
```

## Tests

```
src/__tests__/
├── apply-actions.test.ts       # Financial mutation engine (38 tests)
│   ├── move, create_fund, automate, open_account, pay_off
│   ├── TFSA/RRSP room tracking
│   ├── Custom fund creation + emoji assignment
│   └── Immutability + edge cases
├── app-reducer.test.ts         # State machine transitions (14 tests)
│   ├── UPDATE_PROFILE, SUBMIT_EVENT, COMPLETE_THINKING
│   ├── THINKING_ERROR, RESET, APPLY_ACTIONS
│   └── Guard conditions (wrong-step rejection)
└── pathfinder-engine.test.ts   # AI pipeline (15 tests)
    ├── stripMarkdownFences, parsePathfinderResult
    ├── routeQuery, searchForContext, generatePlan
    └── runPathfinder (full integration)
```

## Design Decisions

1. **Actions map to real Wealthsimple operations** (move, create_fund, automate, open_account, pay_off) -- not abstract advice
2. **Canadian tax rules baked into the system prompt** -- 2026 TFSA/RRSP/FHSA/HBP limits, federal tax brackets, stress test rules
3. **Google Search grounding** for live data -- mortgage rates, childcare costs, tuition fees come from real sources, not training data
4. **State machine with useReducer** -- single source of truth for the entire app flow, no race conditions
5. **Mobile-first, iPhone-like frame on desktop** -- designed for the device people actually manage money on
