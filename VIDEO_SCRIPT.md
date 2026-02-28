# Pathfinder — Video Script

**Duration:** 3–4 minutes

---

## [0:00–0:25] HOOK — The Problem (Personal)

"Four years ago I moved from Israel to Canada. I had savings in shekels, a pension I didn't understand, and zero idea how Canadian tax worked. I lost thousands making wrong financial decisions — not because the information didn't exist, but because no single tool could show me the full picture.

Now imagine every Canadian facing a major life change — having a baby, buying a home, switching careers — trying to mentally calculate how it cascades across their mortgage, investments, taxes, and benefits. Nobody can do that math in their head."

## [0:25–0:35] THE SOLUTION

"So I built Pathfinder — a financial simulation engine for Wealthsimple that takes any life event and produces executable actions, right inside the app."

## [0:35–2:30] LIVE DEMO

Show the app running. Walk through:

1. **Home screen** — "This is your Wealthsimple home. Real accounts, real balances."
2. **Type the event** — "We're having a baby in June and thinking about moving to a bigger place around $650K. My partner will take 12 months parental leave."
3. **Thinking view** — "Pathfinder analyzes in real-time. It decides whether it needs current data — here it's pulling live mortgage rates from Google."
4. **Plan view** — "3 concrete actions. Not generic advice — specific Wealthsimple operations with exact dollar amounts from YOUR accounts."
5. **Tap an action → show confirmation sheet** — "Every action requires explicit confirmation. The AI suggests, the human decides. Money never moves without a double-tap."
6. **Show the "Now" badge** — "Prioritized. What to do right now vs this week vs later."
7. **Switch to Impacts tab** — "The full cascade: income drops 42%, expenses increase, but net worth grows from the house."
8. **Switch to Cashflow tab** — "Monthly cashflow by phase — and here's the key..."
9. **Show Advisor flag** — "Pathfinder knows when to STOP. 'Get mortgage pre-approved before parental leave starts.' This requires a human advisor. The AI flags it."

## [2:30–3:00] ARCHITECTURE (Brief)

"Under the hood: a 3-step AI pipeline. A cheap router model decides if web search is needed. Google grounding pulls live data. The capable model generates the plan. Post-parse guardrails enforce balance limits — the AI can never suggest moving more than you have.

The system knows your data, enriches with real-time context, and produces actions that map directly to Wealthsimple operations."

## [3:00–3:30] HUMAN/AI BOUNDARY

"The most important design decision: where the AI stops. Pathfinder calculates the cascading impact. It suggests concrete actions. But it never moves money without explicit confirmation. It flags advisor moments. It enforces balance limits. In financial services, knowing when NOT to act is just as important as knowing what to recommend."

## [3:30–3:50] PRODUCTION VISION

"In production, Pathfinder doesn't wait for you to ask. It pulls from real Wealthsimple accounts, detects life changes from transaction patterns, and surfaces simulations proactively. Every simulation activates more products, increasing assets under management."

## [3:50–4:00] CLOSE

"That's Pathfinder. The financial digital twin that makes Wealthsimple the only platform where your entire financial life talks to itself."
