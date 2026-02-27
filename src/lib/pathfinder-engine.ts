import { GoogleGenAI } from '@google/genai';
import { PATHFINDER_SYSTEM_PROMPT, buildUserMessage } from '@/lib/prompts';
import type { FinancialProfile, PathfinderResult, SearchMetadata, SearchSource, PathfinderAPIResult } from '@/lib/types';

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

// ── Step 1: Router ───────────────────────────────────────────────────────────

const ROUTER_PROMPT = `You are a financial planning router. Given a user's financial profile and life event, decide whether you need CURRENT internet data to give accurate advice.

Return ONLY valid JSON, no markdown fences:
{ "needs_search": true/false, "queries": ["search query 1", ...] }

Rules for when to search:
- SEARCH if the event involves: current interest/mortgage rates, specific market conditions, recent government program changes, industry-specific costs (e.g. starting a restaurant), tuition for a specific school, regional real-estate prices, current insurance premiums, relocation costs, specific country tax treaties, cost of living comparisons.
- DO NOT SEARCH if the event can be fully handled with: standard Canadian tax rules, well-known registered account rules (TFSA/RRSP/FHSA/RESP), standard EI/CCB benefit calculations, general budgeting math from the user's provided numbers.

If searching, return 1-3 focused queries. Keep queries specific and Canadian-focused.`;

export interface RouterResult {
  needs_search: boolean;
  queries: string[];
}

export async function routeQuery(
  ai: GoogleGenAI,
  profile: FinancialProfile,
  lifeEvent: string,
): Promise<RouterResult> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `FINANCIAL_PROFILE (summary):
Income: $${profile.annualIncome}/yr, Partner: $${profile.partnerIncome}/yr, Province: ${profile.province}
Accounts: TFSA $${profile.tfsaBalance}, RRSP $${profile.rrspBalance}, Savings $${profile.savingsBalance}
Housing: ${profile.housingType}, $${profile.housingExpense}/mo

LIFE_EVENT: ${lifeEvent}`,
    config: {
      systemInstruction: ROUTER_PROMPT,
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
): Promise<PathfinderResult> {
  let userMessage = buildUserMessage(profile, lifeEvent);

  if (searchContext) {
    userMessage += `\n\nRESEARCH_CONTEXT (current data from internet search — use these numbers where relevant):\n${searchContext}`;
  }

  console.info('[Pathfinder] Generating plan:', {
    income: profile.annualIncome,
    province: profile.province,
    event: lifeEvent.slice(0, 80),
    hasResearch: Boolean(searchContext),
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

  return parsePathfinderResult(textContent);
}

// ── Full orchestrator ────────────────────────────────────────────────────────

export async function runPathfinder(
  profile: FinancialProfile,
  lifeEvent: string,
): Promise<PathfinderAPIResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set. Add it to .env to enable AI.');

  const ai = new GoogleGenAI({ apiKey });

  // Step 1: Router
  const route = await routeQuery(ai, profile, lifeEvent);
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

  // Step 3: Generate the plan
  const result = await generatePlan(ai, profile, lifeEvent, searchContext);
  return { result, searchMetadata };
}
