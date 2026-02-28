import { GoogleGenAI } from '@google/genai';
import { PATHFINDER_SYSTEM_PROMPT, buildUserMessage, computeDerivedMetrics } from '@/lib/prompts';
import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, SearchSource, PathfinderAPIResult } from '@/lib/types';

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

function applyPostParseGuardrails(
  result: PathfinderResult,
  profile: FinancialProfile,
  customFunds: CustomFund[],
): PathfinderResult {
  const metrics = computeDerivedMetrics(profile, customFunds);

  // Cap action amounts that exceed source balance
  for (const action of result.quick_actions) {
    if (action.amount && action.from_account) {
      const maxMoveable = metrics.maxMoveableByAccount[action.from_account];
      if (maxMoveable !== undefined && action.amount > maxMoveable) {
        console.warn(
          `[Guardrail] Capped "${action.title}": $${action.amount} → $${maxMoveable} (max for ${action.from_account})`,
        );
        action.amount = maxMoveable;
        // Update the title to reflect the capped amount
        action.title = action.title.replace(
          /\$[\d,]+/,
          `$${maxMoveable.toLocaleString('en-CA')}`,
        );
      }
    }
  }

  // Deduplicate: merge moves to the same destination
  const seenDest = new Map<string, number>();
  const deduped: typeof result.quick_actions = [];
  for (const action of result.quick_actions) {
    if (action.type === 'move' && action.to_account) {
      const key = action.to_account.toLowerCase();
      if (seenDest.has(key)) {
        const firstIdx = seenDest.get(key)!;
        const first = deduped[firstIdx];
        const combinedAmount = (first.amount ?? 0) + (action.amount ?? 0);
        first.amount = combinedAmount;
        first.title = first.title.replace(
          /\$[\d,]+/,
          `$${combinedAmount.toLocaleString('en-CA')}`,
        );
        first.why = [first.why, action.why].filter(Boolean).join('. ');
        console.warn(
          `[Guardrail] Merged duplicate move to "${action.to_account}": combined $${combinedAmount}`,
        );
      } else {
        seenDest.set(key, deduped.length);
        deduped.push(action);
      }
    } else {
      deduped.push(action);
    }
  }
  result.quick_actions = deduped;

  // Trim to 5 actions max
  if (result.quick_actions.length > 5) {
    console.warn(
      `[Guardrail] Trimmed quick_actions from ${result.quick_actions.length} to 5`,
    );
    result.quick_actions = result.quick_actions.slice(0, 5);
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

  return `You are a financial planning router. You receive a user's full financial context and a life event. Decide whether CURRENT internet data would improve the advice.

## Principle
Search when the user's question depends on data that changes over time (interest rates, housing prices, tuition costs, government program updates, insurance premiums, market conditions, cost of living data, specific business costs) and cannot be answered from their profile alone.
Do NOT search for standard Canadian tax rules, well-known registered account rules (TFSA/RRSP/FHSA/RESP), standard EI/CCB calculations, or general budgeting math.

## User Context
- Income: $${profile.annualIncome}/yr, Partner: $${profile.partnerIncome}/yr
- Province: ${profile.province}, Employment: ${profile.employmentType}
- Liquid: $${m.liquidAssets}, Invested: $${m.investedAssets}, Net worth: $${Math.round(m.totalNetWorth)}
- Surplus: $${Math.round(m.monthlySurplus)}/mo (${m.savingsRate}% savings rate)
- Emergency fund: ${m.emergencyFundMonths} months
- TFSA room: $${profile.tfsaRoom}, RRSP room: $${profile.rrspRoom}
- FHSA balance: $${profile.fhsaBalance}${m.isFirstTimeBuyer ? ' (first-time buyer)' : ''}
- Housing: ${profile.housingType}, $${profile.housingExpense}/mo${profile.mortgageBalance > 0 ? `, mortgage: $${profile.mortgageBalance}` : ''}
- Debt payments: $${profile.debtPayments}/mo${profile.creditCardBalance > 0 ? `, credit card: $${profile.creditCardBalance.toFixed(2)}` : ''}
- Custom funds: ${customFundNames}

## Output
Return ONLY valid JSON, no markdown fences:
{ "needs_search": true/false, "queries": ["search query 1", ...] }

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

  const grounding = response.candidates?.[0]?.groundingMetadata;
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

// ── Step 3: Generate ─────────────────────────────────────────────────────────

export async function generatePlan(
  ai: GoogleGenAI,
  profile: FinancialProfile,
  lifeEvent: string,
  searchContext: string | null,
  customFunds: CustomFund[],
): Promise<PathfinderResult> {
  let userMessage = buildUserMessage(profile, lifeEvent, customFunds);

  if (searchContext) {
    userMessage += `\n\nRESEARCH_CONTEXT (current data from internet search — use these numbers where relevant):\n${searchContext}`;
  }

  console.info('[Pathfinder] Generating plan:', {
    income: profile.annualIncome,
    province: profile.province,
    event: lifeEvent.slice(0, 80),
    hasResearch: Boolean(searchContext),
    customFunds: customFunds.length,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userMessage,
    config: {
      systemInstruction: PATHFINDER_SYSTEM_PROMPT,
      temperature: 0.1,
      maxOutputTokens: 16384,
    },
  });

  const textContent = response.text ?? '';
  if (!textContent) {
    throw new Error('No text content in Gemini API response');
  }

  const result = parsePathfinderResult(textContent);
  return applyPostParseGuardrails(result, profile, customFunds);
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

  // Step 1: Router (now sees full context)
  const route = await routeQuery(ai, profile, lifeEvent, customFunds);
  console.info('[Router] Decision:', {
    needs_search: route.needs_search,
    queries: route.queries,
  });

  // Step 2: Search if needed
  let searchContext: string | null = null;
  let searchMetadata: SearchMetadata | null = null;
  if (route.needs_search && route.queries.length > 0) {
    try {
      const searchResult = await searchForContext(ai, route.queries);
      searchContext = searchResult.text;
      searchMetadata = searchResult.metadata;
      console.info('[Search] Got context:', searchContext.slice(0, 200));
    } catch (err) {
      console.warn('[Search] Google Search failed, proceeding without:', err);
    }
  }

  // Step 3: Generate the plan (with guardrails applied post-parse)
  const result = await generatePlan(ai, profile, lifeEvent, searchContext, customFunds);
  return { result, searchMetadata };
}
