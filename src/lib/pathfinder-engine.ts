import { GoogleGenAI } from '@google/genai';
import { PATHFINDER_SYSTEM_PROMPT, buildUserMessage, computeDerivedMetrics } from '@/lib/prompts';
import type { DerivedMetrics } from '@/lib/prompts';
import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, SearchSource, PathfinderAPIResult, QuickAction, DebugLog, DebugLogEntry } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) cleaned = cleaned.slice(firstNewline + 1);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3).trimEnd();
  }
  return cleaned.trim();
}

export function parsePathfinderResult(rawText: string): PathfinderResult {
  const cleaned = stripMarkdownFences(rawText);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON Parse Error:', e);
    console.error('Raw content:', rawText.slice(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }

  const requiredKeys: (keyof PathfinderResult)[] = [
    'thinking_steps',
    'impact_summary',
    'quick_actions',
    'advisor_flags',
    'risk_warnings',
    'monthly_cashflow',
  ];

  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`Missing required key in Pathfinder result: ${key}`);
    }
  }

  return parsed as PathfinderResult;
}

// ── Post-Parse Guardrails ───────────────────────────────────────────────────

/** Normalise account name for matching */
function normAccount(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

/** Room available to deposit into a registered account */
function roomFor(account: string, profile: FinancialProfile, metrics: DerivedMetrics): number | null {
  const norm = normAccount(account);
  if (norm === 'tfsa') return profile.tfsaRoom;
  if (norm === 'rrsp') return profile.rrspRoom;
  if (norm === 'fhsa') return metrics.isFirstTimeBuyer ? Math.max(0, 8000 - profile.fhsaBalance) : 0;
  if (norm === 'resp') return 2500;
  return null; // non-registered or custom fund — no room cap
}

/** Strip leaked prompt internals from derived_from text */
function sanitizeDerivedFrom(text: string): string {
  return text
    .replace(/\bRESEARCH_CONTEXT\b/gi, 'live data')
    .replace(/\bLIFE_EVENT\b/gi, 'your scenario')
    .replace(/\bsystem prompt\b/gi, 'guidelines')
    .trim();
}

/**
 * Build a mutable ledger of available balances.
 * As each action is validated, its cost is deducted so later actions
 * see the REMAINING balance — not the original.
 */
function buildBalanceLedger(
  profile: FinancialProfile,
  customFunds: CustomFund[],
): Map<string, number> {
  const ledger = new Map<string, number>();
  ledger.set('chequing', Math.max(0, profile.chequingBalance - 500)); // keep $500 floor
  ledger.set('savings', profile.savingsBalance);
  ledger.set('tfsa', profile.tfsaBalance);
  ledger.set('rrsp', profile.rrspBalance);
  ledger.set('fhsa', profile.fhsaBalance);
  ledger.set('nonregistered', profile.nonRegBalance);
  for (const fund of customFunds) {
    ledger.set(normAccount(fund.name), fund.balance);
  }
  return ledger;
}

function buildRoomLedger(profile: FinancialProfile, metrics: DerivedMetrics): Map<string, number> {
  const ledger = new Map<string, number>();
  ledger.set('tfsa', profile.tfsaRoom);
  ledger.set('rrsp', profile.rrspRoom);
  ledger.set('fhsa', metrics.isFirstTimeBuyer ? Math.max(0, 8000 - profile.fhsaBalance) : 0);
  ledger.set('resp', 2500);
  return ledger;
}

function applyPostParseGuardrails(
  result: PathfinderResult,
  profile: FinancialProfile,
  customFunds: CustomFund[],
  lifeEvent: string,
  removedActions: string[] = [],
): PathfinderResult {
  const metrics = computeDerivedMetrics(profile, customFunds);
  const balanceLedger = buildBalanceLedger(profile, customFunds);
  const roomLedger = buildRoomLedger(profile, metrics);

  const validated: QuickAction[] = [];

  for (const action of result.quick_actions) {
    let keep = true;
    const sourceKey = action.from_account ? normAccount(action.from_account) : null;
    const destKey = action.to_account ? normAccount(action.to_account) : null;

    // ── FHSA eligibility ──
    if (destKey === 'fhsa' && !metrics.isFirstTimeBuyer) {
      removedActions.push(`"${action.title}" — not first-time buyer`);
      continue;
    }

    // ── Pay-off: debt must exist ──
    if (action.type === 'pay_off') {
      const hint = (action.to_account || action.title || '').toLowerCase();
      if ((hint.includes('credit') || hint.includes('card')) && profile.creditCardBalance <= 0) {
        removedActions.push(`"${action.title}" — no credit card balance`);
        continue;
      }
      if (hint.includes('mortgage') && profile.mortgageBalance <= 0) {
        removedActions.push(`"${action.title}" — no mortgage`);
        continue;
      }
    }

    // ── Automation: surplus must support it ──
    if (action.type === 'automate' && action.automation) {
      if (metrics.monthlySurplus < 100) {
        removedActions.push(`"${action.title}" — surplus too low ($${Math.round(metrics.monthlySurplus)})`);
        continue;
      }
      if (action.automation.amount > metrics.monthlySurplus * 0.9) {
        // Cap the automation amount to 80% of surplus instead of removing
        action.automation.amount = Math.round(metrics.monthlySurplus * 0.8);
        console.warn(`[Guardrail] Capped automation "${action.title}" to $${action.automation.amount}/mo`);
      }
    }

    // ── Source balance check (against running ledger) ──
    if (sourceKey && action.amount && action.amount > 0) {
      const available = balanceLedger.get(sourceKey);
      if (available !== undefined) {
        if (available <= 0) {
          removedActions.push(`"${action.title}" — ${action.from_account} has $0 left`);
          continue;
        }
        if (action.amount > available) {
          console.warn(`[Guardrail] Capped "${action.title}": $${action.amount} → $${available} (remaining in ${action.from_account})`);
          action.amount = available;
          action.title = action.title.replace(/\$[\d,.]+/, `$${available.toLocaleString('en-CA')}`);
        }
      } else {
        // Source account not found in ledger — AI hallucinated or misspelled the account name
        console.warn(`[Guardrail] Removed "${action.title}" — source "${action.from_account}" not found in any account`);
        removedActions.push(`"${action.title}" — unknown source account "${action.from_account}"`);
        continue;
      }
    }

    // ── Destination room check (against running room ledger) ──
    if (destKey && action.amount && action.amount > 0 && (action.type === 'move' || action.type === 'create_fund')) {
      const room = roomLedger.get(destKey);
      if (room !== undefined) {
        if (room <= 0) {
          removedActions.push(`"${action.title}" — $0 room in ${action.to_account}`);
          continue;
        }
        if (action.amount > room) {
          console.warn(`[Guardrail] Capped "${action.title}" to room: $${action.amount} → $${room} (${action.to_account})`);
          action.amount = room;
          action.title = action.title.replace(/\$[\d,.]+/, `$${room.toLocaleString('en-CA')}`);
        }
      }
    }

    // ── Remove $0 or negative amount actions ──
    if ((action.type === 'move' || action.type === 'pay_off') && action.amount !== undefined && action.amount <= 0) {
      removedActions.push(`"${action.title}" — capped to $0`);
      continue;
    }

    // ── DEDUCT from ledgers so the next action sees remaining balance ──
    if (sourceKey && action.amount && action.amount > 0) {
      const prev = balanceLedger.get(sourceKey) ?? 0;
      balanceLedger.set(sourceKey, Math.max(0, prev - action.amount));
    }
    if (destKey && action.amount && action.amount > 0) {
      const prevRoom = roomLedger.get(destKey);
      if (prevRoom !== undefined) {
        roomLedger.set(destKey, Math.max(0, prevRoom - action.amount));
      }
    }

    // ── Sanitize derived_from ──
    action.derived_from = sanitizeDerivedFrom(action.derived_from || '');

    // ── Ensure derived_from includes $ amounts ──
    if (action.amount && !action.derived_from.includes('$')) {
      if (action.from_account && action.to_account) {
        action.derived_from = `${action.from_account} $${action.amount.toLocaleString('en-CA')} → ${action.to_account}`;
      }
    }

    validated.push(action);
  }

  result.quick_actions = validated;

  // ── Deduplicate moves: only merge if SAME source AND SAME destination ──
  const seenKey = new Map<string, number>();
  const deduped: QuickAction[] = [];
  for (const action of result.quick_actions) {
    if (action.type === 'move' && action.to_account && action.from_account) {
      const key = `${normAccount(action.from_account)}→${normAccount(action.to_account)}`;
      if (seenKey.has(key)) {
        const firstIdx = seenKey.get(key)!;
        const first = deduped[firstIdx];
        const combinedAmount = (first.amount ?? 0) + (action.amount ?? 0);
        first.amount = combinedAmount;
        first.title = first.title.replace(/\$[\d,.]+/, `$${combinedAmount.toLocaleString('en-CA')}`);
        first.why = [first.why, action.why].filter(Boolean).join('. ');
      } else {
        seenKey.set(key, deduped.length);
        deduped.push(action);
      }
    } else {
      deduped.push(action);
    }
  }
  result.quick_actions = deduped;

  // ── Dynamic action count limit based on prompt complexity ──
  const separators = /\b(and|plus|also|,)\b/gi;
  const subSituations = lifeEvent.split(separators).filter(s => s.trim().length > 10);
  const isComplex = subSituations.length >= 3;
  // Simple = very short, single-verb requests like "max TFSA", "pay off credit card"
  const wordCount = lifeEvent.split(/\s+/).length;
  const isSimple = subSituations.length <= 1 && wordCount <= 6;
  const maxActions = isComplex ? 7 : isSimple ? 2 : 4;

  if (result.quick_actions.length > maxActions) {
    console.warn(`[Guardrail] Trimmed from ${result.quick_actions.length} to ${maxActions} (complexity: ${isComplex ? 'complex' : isSimple ? 'simple' : 'moderate'}, words: ${wordCount})`);
    result.quick_actions = result.quick_actions.slice(0, maxActions);
  }

  // ── Rebuild account_impacts from REAL balances + validated actions ──
  const actualBalances: Record<string, number> = {
    'Chequing': profile.chequingBalance,
    'Savings': profile.savingsBalance,
    'TFSA': profile.tfsaBalance,
    'RRSP': profile.rrspBalance,
    'FHSA': profile.fhsaBalance,
    'Non-Registered': profile.nonRegBalance,
  };
  for (const fund of customFunds) {
    actualBalances[fund.name] = fund.balance;
  }

  // Compute net deltas per account from the validated actions
  const accountDeltas = new Map<string, number>();
  for (const action of result.quick_actions) {
    const amount = action.amount ?? 0;
    if (amount <= 0) continue;

    // Withdrawals from source
    if (action.from_account) {
      const srcNorm = normAccount(action.from_account);
      accountDeltas.set(srcNorm, (accountDeltas.get(srcNorm) ?? 0) - amount);
    }
    // Deposits to destination (for move, create_fund, open_account)
    if (action.to_account && (action.type === 'move' || action.type === 'create_fund' || action.type === 'open_account')) {
      const destNorm = normAccount(action.to_account);
      accountDeltas.set(destNorm, (accountDeltas.get(destNorm) ?? 0) + amount);
    }
    // Automations: show first month impact
    if (action.type === 'automate' && action.automation && action.automation.amount > 0) {
      const autoAmt = action.automation.amount;
      const srcNorm = action.from_account ? normAccount(action.from_account) : 'chequing';
      accountDeltas.set(srcNorm, (accountDeltas.get(srcNorm) ?? 0) - autoAmt);
      if (action.to_account) {
        const destNorm = normAccount(action.to_account);
        accountDeltas.set(destNorm, (accountDeltas.get(destNorm) ?? 0) + autoAmt);
      }
    }
    // Pay-off: reduce credit card debt
    if (action.type === 'pay_off') {
      accountDeltas.set('creditcard', (accountDeltas.get('creditcard') ?? 0) - amount);
    }
  }

  // Build a lookup of AI hints (impact_text, note) keyed by normalized account name
  const aiHints = new Map<string, { impact_text: string; note?: string }>();
  if (result.account_impacts) {
    for (const impact of result.account_impacts) {
      aiHints.set(normAccount(impact.account_name), {
        impact_text: impact.impact_text,
        note: impact.note,
      });
    }
  }

  // Rebuild account_impacts from real data + computed deltas
  const computedImpacts: typeof result.account_impacts = [];
  for (const [name, currentBalance] of Object.entries(actualBalances)) {
    const norm = normAccount(name);
    const delta = accountDeltas.get(norm) ?? 0;
    if (delta === 0) continue; // Only show accounts affected by actions

    let projected = currentBalance + delta;

    // Cap registered accounts to room
    if (norm === 'tfsa') {
      projected = Math.min(projected, profile.tfsaBalance + profile.tfsaRoom);
    } else if (norm === 'rrsp') {
      projected = Math.min(projected, profile.rrspBalance + profile.rrspRoom);
    } else if (norm === 'fhsa') {
      projected = Math.min(projected, Math.min(40000, profile.fhsaBalance + Math.max(0, 8000 - profile.fhsaBalance)));
    }
    // Credit card can't go below 0
    if (norm === 'creditcard') {
      projected = Math.max(0, profile.creditCardBalance + delta);
    }
    projected = Math.max(0, projected);

    const hint = aiHints.get(norm);
    const status = projected > currentBalance ? 'positive' : projected < currentBalance ? 'negative' : 'neutral';

    computedImpacts.push({
      account_name: name,
      current_balance: currentBalance,
      projected_balance: Math.round(projected),
      impact_text: hint?.impact_text ?? (delta > 0 ? `+$${delta.toLocaleString('en-CA')} from actions` : `-$${Math.abs(delta).toLocaleString('en-CA')} from actions`),
      status: norm === 'creditcard' && delta < 0 ? 'positive' : status, // Paying off debt is positive
      note: hint?.note,
    });
  }

  // Also add impacts for NEW funds created by actions (not in profile yet)
  for (const [normName, delta] of accountDeltas.entries()) {
    if (delta <= 0) continue;
    const alreadyIncluded = Object.keys(actualBalances).some(k => normAccount(k) === normName);
    if (alreadyIncluded) continue;
    // Find the display name from the action
    const displayName = result.quick_actions.find(
      a => a.to_account && normAccount(a.to_account) === normName
    )?.to_account ?? normName;
    const hint = aiHints.get(normName);
    computedImpacts.push({
      account_name: displayName,
      current_balance: 0,
      projected_balance: Math.round(delta),
      impact_text: hint?.impact_text ?? `New fund: $${delta.toLocaleString('en-CA')}`,
      status: 'positive',
      note: hint?.note,
    });
  }

  result.account_impacts = computedImpacts;

  // ── Rebuild monthly_cashflow from real surplus + action automations ──
  const actualSurplus = Math.round(metrics.monthlySurplus);

  // Sum up monthly automation amounts from validated actions
  let totalMonthlyAutomation = 0;
  for (const action of result.quick_actions) {
    if (action.type === 'automate' && action.automation && action.automation.amount > 0) {
      totalMonthlyAutomation += action.automation.amount;
    }
  }

  if (result.monthly_cashflow && result.monthly_cashflow.length > 0) {
    // Coerce all amounts to numbers
    for (const entry of result.monthly_cashflow) {
      if (typeof entry.amount === 'string') {
        const stripped = (entry.amount as string).replace(/[^0-9.\-]/g, '');
        entry.amount = Number(stripped) || 0;
      } else {
        entry.amount = Number(entry.amount) || 0;
      }
    }

    // Fix first phase to actual surplus
    const first = result.monthly_cashflow[0];
    if (first.amount !== actualSurplus) {
      console.warn(`[Guardrail] Fixed cashflow "${first.phase}": AI said $${first.amount}, actual surplus $${actualSurplus}`);
      first.amount = actualSurplus;
    }

    // Fix second phase if it exists — anchor to surplus minus automations
    if (result.monthly_cashflow.length >= 2 && totalMonthlyAutomation > 0) {
      const second = result.monthly_cashflow[1];
      const adjustedSurplus = actualSurplus - totalMonthlyAutomation;
      if (second.amount !== adjustedSurplus) {
        console.warn(`[Guardrail] Fixed cashflow "${second.phase}": AI said $${second.amount}, adjusted to $${adjustedSurplus} (surplus $${actualSurplus} - automations $${totalMonthlyAutomation})`);
        second.amount = adjustedSurplus;
      }
    }
  } else {
    // AI didn't provide cashflow at all — build from scratch
    const phases: typeof result.monthly_cashflow = [
      { phase: 'Current', amount: actualSurplus },
    ];
    if (totalMonthlyAutomation > 0) {
      phases.push({ phase: 'After plan', amount: actualSurplus - totalMonthlyAutomation });
    }
    result.monthly_cashflow = phases;
  }

  return result;
}

// ── Step 1: Router ───────────────────────────────────────────────────────────

function buildRouterPrompt(
  profile: FinancialProfile,
  customFunds: CustomFund[],
): string {
  const m = computeDerivedMetrics(profile, customFunds);
  const customFundNames = customFunds.map(f => f.name).join(', ') || 'none';

  return `You are a financial planning router. You receive a user's full financial context and a life event. Decide whether CURRENT internet data would materially change the recommended dollar amounts or strategy.

## Principle
Ask yourself: "Would last year's numbers give wrong advice?" If yes → search.

SEARCH when the plan depends on:
- Current interest rates, GIC rates, mortgage rates (change weekly)
- Housing prices in a specific city or region
- Tuition or program costs at specific institutions
- Government program updates that may have changed recently
- Insurance premiums or quotes
- Specific business startup costs, licensing fees, industry data
- Cost of living in a specific city (for relocation)
- Current market conditions affecting investment strategy

DO NOT SEARCH for:
- Tax bracket math (stable, already in system prompt)
- TFSA/RRSP/FHSA/RESP rules and limits (already in system prompt for 2026)
- Standard EI/CCB formulas (already in system prompt)
- General budgeting or savings rate calculations
- The user's own numbers (already provided)

When in doubt: search. Cost is 1-2s latency; stale data leads to wrong dollar amounts.

## User Context
- Income: $${profile.annualIncome}/yr, Partner: $${profile.partnerIncome}/yr
- Province: ${profile.province}, Employment: ${profile.employmentType}
- Liquid: $${m.liquidAssets}, Invested: $${m.investedAssets}, Net worth: $${Math.round(m.totalNetWorth)}
- Surplus: $${Math.round(m.monthlySurplus)}/mo (${m.savingsRate}% savings rate)
- Emergency fund: ${m.emergencyFundMonths} months
- TFSA deposit room (contribution space, NOT balance): $${profile.tfsaRoom}, RRSP deposit room: $${profile.rrspRoom}
- FHSA balance: $${profile.fhsaBalance}${m.isFirstTimeBuyer ? ' (first-time buyer)' : ''}
- Housing: ${profile.housingType}, $${profile.housingExpense}/mo${profile.mortgageBalance > 0 ? `, mortgage: $${profile.mortgageBalance}` : ''}
- Debt payments: $${profile.debtPayments}/mo${profile.creditCardBalance > 0 ? `, credit card: $${profile.creditCardBalance.toFixed(2)}` : ''}
- Custom funds: ${customFundNames}

## Output
Return ONLY valid JSON, no markdown fences:
{ "needs_search": true/false, "reasoning": "one sentence why", "queries": ["search query 1", ...] }

If searching, return 1-3 focused, specific, Canadian-focused queries.`;
}

export interface RouterResult {
  needs_search: boolean;
  queries: string[];
}

export async function routeQuery(
  ai: GoogleGenAI,
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[],
): Promise<RouterResult> {
  const routerPrompt = buildRouterPrompt(profile, customFunds);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `LIFE_EVENT: ${lifeEvent}`,
    config: {
      systemInstruction: routerPrompt,
      temperature: 0,
      maxOutputTokens: 256,
    },
  });

  const text = response.text?.trim() ?? '';
  try {
    const cleaned = stripMarkdownFences(text);
    const parsed = JSON.parse(cleaned);
    if (parsed.reasoning) {
      console.info('[Router] Reasoning:', parsed.reasoning);
    }
    return {
      needs_search: Boolean(parsed.needs_search),
      queries: Array.isArray(parsed.queries) ? parsed.queries.slice(0, 3) : [],
    };
  } catch {
    console.warn('[Router] Failed to parse, skipping search:', text.slice(0, 200));
    return { needs_search: false, queries: [] };
  }
}

// ── Step 2: Search ───────────────────────────────────────────────────────────

export interface SearchResult {
  text: string;
  metadata: SearchMetadata;
}

export async function searchForContext(
  ai: GoogleGenAI,
  queries: string[],
): Promise<SearchResult> {
  const combined = queries.join('\n- ');
  const prompt = `Research the following topics and provide a concise factual summary for each. Include specific numbers, dates, and sources where possible. Keep each topic to 2-3 sentences.

Topics:
- ${combined}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0,
      maxOutputTokens: 1024,
    },
  });

  const text = response.text ?? '';
  const sources: SearchSource[] = [];
  const searchQueries: string[] = [];

  // Debug: log raw response structure to diagnose grounding issues
  console.info('[Search] Response keys:', Object.keys(response));
  console.info('[Search] Candidates:', JSON.stringify(response.candidates?.map(c => Object.keys(c)), null, 2));
  const grounding = response.candidates?.[0]?.groundingMetadata;
  console.info('[Search] Grounding metadata:', grounding ? Object.keys(grounding) : 'null');
  if (grounding?.webSearchQueries) {
    searchQueries.push(...grounding.webSearchQueries);
    console.info('[Search] Queries used:', grounding.webSearchQueries);
  }
  if (grounding?.groundingChunks) {
    for (const chunk of grounding.groundingChunks) {
      if (chunk.web?.uri) {
        sources.push({ title: chunk.web.title, url: chunk.web.uri });
      }
    }
    console.info('[Search] Sources:', sources.slice(0, 5).map(s => s.url));
  }

  return {
    text,
    metadata: { queries: searchQueries, sources: sources.slice(0, 8) },
  };
}

// ── Pre-Think (fast thinking preview) ────────────────────────────────────────

import type { ThinkingStep } from '@/lib/types';

const THINKING_PREVIEW_PROMPT = `You are a financial analyst. Analyze the user's financial snapshot and life event. Output ONLY a JSON array of thinking_steps showing your reasoning.

Each step has:
- "title": 3-5 word label (e.g. "Emergency Fund Check", "Income Impact Analysis")
- "insights": array of {"text": "ONE punchy line with exact $ amounts", "type": "positive|negative|neutral"}

Rules:
- 4-6 steps. For multi-scenario events, one step per sub-situation + a synthesis step.
- Reference EXACT dollar amounts from the user's data.
- Be specific and concise. No filler.
- Return ONLY valid JSON array. No markdown fences.

Example output:
[
  {"title":"Emergency Buffer","insights":[{"text":"$30K liquid covers 4.2 months of expenses","type":"positive"}]},
  {"title":"TFSA Opportunity","insights":[{"text":"$7K room available — tax-free growth","type":"positive"},{"text":"Maxing saves ~$350/yr in tax on gains","type":"neutral"}]}
]`;

export async function generateThinkingPreview(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): Promise<ThinkingStep[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });
  const userMessage = buildUserMessage(profile, lifeEvent, customFunds);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: userMessage,
    config: {
      systemInstruction: THINKING_PREVIEW_PROMPT,
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  });

  const text = response.text?.trim() ?? '';
  try {
    const cleaned = stripMarkdownFences(text);
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed as ThinkingStep[];
    }
    // If the model wrapped it in an object
    if (parsed.thinking_steps && Array.isArray(parsed.thinking_steps)) {
      return parsed.thinking_steps as ThinkingStep[];
    }
    throw new Error('Unexpected format');
  } catch (err) {
    console.warn('[PreThink] Failed to parse:', text.slice(0, 300));
    // Return a reasonable fallback
    return [
      { title: 'Analyzing Finances', insights: [{ text: `Reviewing your financial snapshot`, type: 'neutral' }] },
      { title: 'Running Scenarios', insights: [{ text: `Simulating impact of your life event`, type: 'neutral' }] },
    ];
  }
}

// ── Full orchestrator ────────────────────────────────────────────────────────

export async function runPathfinder(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): Promise<PathfinderAPIResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set. Add it to .env to enable AI.');

  const ai = new GoogleGenAI({ apiKey });
  const log: DebugLogEntry[] = [];
  const removedActions: string[] = [];

  // Step 1: Router
  const route = await routeQuery(ai, profile, lifeEvent, customFunds);
  console.info('[Pipeline] Router result:', JSON.stringify(route));
  log.push({
    step: 'Router',
    detail: route.needs_search
      ? `Search needed: ${route.queries.join(', ')}`
      : 'No search needed',
  });

  // Step 2: Search if needed
  let searchContext: string | null = null;
  let searchMetadata: SearchMetadata | null = null;
  if (route.needs_search && route.queries.length > 0) {
    try {
      const searchResult = await searchForContext(ai, route.queries);
      searchContext = searchResult.text;
      searchMetadata = searchResult.metadata;
      log.push({
        step: 'Search',
        detail: `Found ${searchResult.metadata.sources.length} sources`,
        data: searchContext.slice(0, 300),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Search] Failed:', msg);
      log.push({ step: 'Search', detail: `Search failed: ${msg}` });
    }
  }

  // Step 3: Generate the plan
  let userMessage = buildUserMessage(profile, lifeEvent, customFunds);
  if (searchContext) {
    userMessage += `\n\nRESEARCH_CONTEXT (current data from internet search — use these numbers where relevant):\n${searchContext}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userMessage,
    config: {
      systemInstruction: PATHFINDER_SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 16384,
    },
  });

  const textContent = response.text ?? '';
  if (!textContent) throw new Error('No text content in Gemini API response');

  const rawResult = parsePathfinderResult(textContent);
  const actionsBeforeGuardrails = rawResult.quick_actions.length;

  log.push({
    step: 'Generate',
    detail: `AI produced ${actionsBeforeGuardrails} actions`,
    data: rawResult.quick_actions.map(a => a.title).join(' | '),
  });

  // Step 4: Guardrails
  const result = applyPostParseGuardrails(rawResult, profile, customFunds, lifeEvent, removedActions);

  if (removedActions.length > 0) {
    log.push({
      step: 'Guardrail',
      detail: `Removed ${removedActions.length}, kept ${result.quick_actions.length}`,
      data: removedActions.join(' | '),
    });
  }

  const debugLog: DebugLog = {
    entries: log,
    actionsBeforeGuardrails,
    actionsAfterGuardrails: result.quick_actions.length,
    removedActions,
  };

  return { result, searchMetadata, debugLog };
}
