# Pathfinder evals

A deterministic eval harness for the Pathfinder AI pipeline. It answers the
question a portfolio reviewer actually cares about: **does the AI engineering
work, and how do you know?**

## The idea

Pathfinder's thesis is *the model proposes, deterministic code disposes*. An LLM
drafts a financial plan; a guardrail layer (`applyPostParseGuardrails` in
`src/lib/pathfinder-engine.ts`) then re-derives every dollar from the user's real
balances, strips impossible or off-topic suggestions, and rebuilds the impact
math. The evals test **that layer**, which is the part we engineer and own.

We never call a live model here. Each scenario carries a **recorded raw model
response** — sometimes deliberately wrong (over-budget moves, an FHSA deposit for
someone who already owns a home, a credit-card pay-off with no debt, generic
chain-of-thought) — and we replay it through the real `parse → guardrails`
pipeline. That keeps the suite **fast, deterministic, and runnable in CI with no
API keys**.

## What each metric proves

| Metric | Invariant |
| --- | --- |
| `balance_room_safety` | No surviving action moves more than the source holds (with the $500 chequing floor) or exceeds registered-account room. Re-derived independently from the profile. |
| `relevance_filter` | Surviving `thinking_steps` are a fixed point of the relevance filter — generic profile audits and abandoned-goal reasoning are gone, on-topic steps remain. |
| `math_consistency` | First cashflow phase equals real surplus, `account_impacts` carry real balances (or $0 for new funds), and net-worth value equals the sum of action values. |
| `eligibility_removals` | Impossible/ineligible actions were removed for the right reason, and shortfalls were auto-split into a follow-up automation. |
| `action_count_discipline` | The plan respects the complexity-derived action cap (simple → 2, moderate → 4, complex → 7). |

## Run it

```bash
npm run eval
```

This prints a scorecard, writes [`RESULTS.md`](./RESULTS.md) and `results.json`,
and fails (non-zero exit) if any metric drops below 100% — so a regression in the
guardrails breaks CI.

## Add a scenario

Append an `EvalScenario` to `scenarios.ts`: a `profile`, a `lifeEvent`, a
recorded `rawAiResponse` (ideally containing a violation to catch), and the
`expect` block. The harness scores it automatically.
