import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { buildPathfinderSystemPrompt, buildUserMessage } from '@/lib/prompts';
import { parsePathfinderResult, applyPostParseGuardrails } from '@/lib/pathfinder-engine';
import { getCanadianRuleSet } from '@/lib/prompts';
import type { FinancialProfile, CustomFund, PathfinderResult } from '@/lib/types';

interface RefineRequestBody {
  profile: FinancialProfile;
  customFunds: CustomFund[];
  originalEvent: string;
  originalResult: PathfinderResult;
  adjustment: string;
}

/** Call Claude (primary) with Gemini fallback for refinement */
async function callRefine(system: string, userMessage: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GOOGLE_API_KEY;

  if (anthropicKey) {
    try {
      const claude = new Anthropic({ apiKey: anthropicKey });
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        system,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
      });
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
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
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GOOGLE_API_KEY;
    if (!anthropicKey && !geminiKey) {
      return NextResponse.json({ error: 'No AI API keys configured' }, { status: 500 });
    }

    const body: RefineRequestBody = await request.json();
    if (!body.profile || !body.adjustment || !body.originalResult) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Refine API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
