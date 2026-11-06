import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { draftPlan } from '@/lib/plan-model';
import { buildPathfinderSystemPrompt, buildUserMessage } from '@/lib/prompts';
import { parsePathfinderResult, applyPostParseGuardrails } from '@/lib/pathfinder-engine';
import { getCanadianRuleSet } from '@/lib/prompts';
import type { FinancialProfile, CustomFund, PathfinderResult } from '@/lib/types';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { NO_AI_KEYS } from '@/lib/claude';

interface RefineRequestBody {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  originalEvent: string;
  originalResult: PathfinderResult;
  adjustment: string;
}

const MAX_ADJUSTMENT_LENGTH = 280;

/** Call Claude (primary) with Gemini fallback for refinement */
async function callRefine(system: string, userMessage: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GOOGLE_API_KEY;

  if (anthropicKey) {
    try {
      const text = await draftPlan(anthropicKey, system, userMessage);
      if (text) return text;
    } catch (err) {
      console.warn('[Refine] Claude failed, falling back to Gemini:', err instanceof Error ? err.message : String(err));
    }
  }

  if (!geminiKey) throw new Error('No AI API keys configured');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userMessage,
    config: {
      systemInstruction: system,
      temperature: 0.3,
      maxOutputTokens: 16384,
    },
  });
  return response.text ?? '';
}

export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GOOGLE_API_KEY;
    if (!anthropicKey && !geminiKey) {
      return NextResponse.json({ error: 'No AI API keys configured', code: NO_AI_KEYS }, { status: 503 });
    }

    let body: RefineRequestBody;
    try {
      body = await request.json() as RefineRequestBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body.profile || !body.adjustment || !body.originalResult) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof body.adjustment !== 'string' || body.adjustment.length > MAX_ADJUSTMENT_LENGTH) {
      return NextResponse.json({ error: `adjustment must be a string under ${MAX_ADJUSTMENT_LENGTH} chars` }, { status: 400 });
    }

    const baseSystemPrompt = buildPathfinderSystemPrompt(new Date());
    const userMessage = buildUserMessage(body.profile, body.originalEvent, body.customFunds);

    const refinementPrompt = `${baseSystemPrompt}

IMPORTANT CONTEXT: The user has already received a financial plan and is asking for a refinement.

Their original plan (JSON):
${JSON.stringify(body.originalResult, null, 2)}

The user's adjustment request: "${body.adjustment}"

Produce a REFINED plan that incorporates this adjustment. Keep the same JSON format.
Only change what the adjustment requires — keep unchanged parts stable.
Output ONLY valid JSON. No markdown fences.`;

    const textContent = await callRefine(
      refinementPrompt,
      `${userMessage}\n\nREFINEMENT REQUEST: ${body.adjustment}`,
    );

    if (!textContent) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = parsePathfinderResult(textContent);
    const rules = getCanadianRuleSet();
    const result = applyPostParseGuardrails(parsed, body.profile, body.customFunds ?? [], body.originalEvent, rules);
    return NextResponse.json({ result }, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Refine API] Error:', message);
    return NextResponse.json({ error: 'Refinement failed. Please try again.' }, { status: 500 });
  }
}
