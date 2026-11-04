import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { buildPathfinderSystemPrompt, buildUserMessage, getCanadianRuleSet } from '@/lib/prompts';
import {
  routeQuery,
  searchForContext,
  generateThinkingPreview,
  parsePathfinderResult,
  applyPostParseGuardrails,
} from '@/lib/pathfinder-engine';
import type { DebugLogEntry } from '@/lib/types';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { validatePathfinderInput } from '@/lib/validate-request';
import { NO_AI_KEYS } from '@/lib/claude';

/** Call Claude (primary) with automatic Gemini fallback — for generation */
async function callGenerate(system: string, userMessage: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GOOGLE_API_KEY;

  if (anthropicKey) {
    try {
      const claude = new Anthropic({ apiKey: anthropicKey });
      console.info('[Stream] Calling Claude claude-sonnet-4-6...');
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        system,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
      });
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      if (text) {
        console.info(`[Stream] Claude responded (${text.length} chars)`);
        return text;
      }
      console.warn('[Stream] Claude returned empty, falling back to Gemini');
    } catch (err) {
      console.warn('[Stream] Claude failed, falling back to Gemini:', err instanceof Error ? err.message : String(err));
    }
  }

  if (!geminiKey) throw new Error('No AI API keys configured');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  console.info('[Stream] Falling back to Gemini gemini-2.5-flash...');
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GOOGLE_API_KEY;
  if (!anthropicKey && !geminiKey) {
    return new Response(JSON.stringify({ error: 'No AI API keys configured', code: NO_AI_KEYS }), { status: 503 });
  }

  const limit = checkRateLimit(request);
  if (!limit.ok) {
    const message = limit.reason === 'global'
      ? 'Pathfinder is over its daily AI budget. Please come back tomorrow.'
      : 'Too many plans from your IP today. Try again in a few hours.';
    return new Response(
      JSON.stringify({ error: message, retryAfter: limit.retryAfterSeconds }),
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const validation = validatePathfinderInput(raw);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.message }), { status: validation.status });
  }
  const { profile, lifeEvent, customFunds } = validation;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const rules = getCanadianRuleSet();
      const systemPrompt = buildPathfinderSystemPrompt(new Date());
      const log: DebugLogEntry[] = [];
      const removedActions: string[] = [];

      try {
        // ── Fire Router + Analyze in PARALLEL (saves ~1s) ──
        send({ type: 'step', id: 'router', status: 'active', label: 'Reading your situation' });
        send({ type: 'step', id: 'analyze', status: 'active', label: 'Running your numbers' });

        const routerPromise = routeQuery(profile, lifeEvent, customFunds);
        const preThinkPromise = generateThinkingPreview(profile, lifeEvent, customFunds)
          .then((steps) => {
            if (steps.length > 0) {
              send({ type: 'thinking_steps', steps });
            }
            send({ type: 'step', id: 'analyze', status: 'complete', label: 'Ran your numbers' });
          })
          .catch(() => {
            send({ type: 'step', id: 'analyze', status: 'complete', label: 'Ran your numbers' });
          });

        // Wait for router (analyze continues in background)
        const route = await routerPromise;
        log.push({
          step: 'Router',
          detail: route.needs_search
            ? `Search needed: ${route.queries.join(', ')}`
            : 'No search needed',
          data: route.reasoning,
        });
        send({
          type: 'step',
          id: 'router',
          status: 'complete',
          label: 'Read your situation',
          detail: route.needs_search ? 'This needs live data' : 'Your numbers are enough',
        });

        // ── Search (if needed) ──
        let searchContext: string | null = null;
        let searchMetadata = null;
        if (route.needs_search && route.queries.length > 0) {
          send({ type: 'step', id: 'search', status: 'active', label: 'Searching the web', detail: route.queries[0] });
          try {
            const searchResult = await searchForContext(route.queries);
            searchContext = searchResult.text;
            searchMetadata = searchResult.metadata;
            log.push({
              step: 'Search',
              detail: `Found ${searchResult.metadata.sources.length} sources`,
              data: searchContext.slice(0, 300),
            });
            send({
              type: 'step',
              id: 'search',
              status: 'complete',
              label: `Checked ${searchResult.metadata.sources.length} live sources`,
              detail: JSON.stringify(searchResult.metadata.sources.slice(0, 5).map(s => ({
                title: s.title || 'Web Result',
                url: s.url,
              }))),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.push({ step: 'Search', detail: `Search failed: ${msg}` });
            send({ type: 'step', id: 'search', status: 'complete', label: "Couldn't reach live data", detail: 'Using built-in rules instead' });
          }
        }

        // ── Generate plan (with heartbeat so UI doesn't feel stuck) ──
        send({ type: 'step', id: 'generate', status: 'active', label: 'Drafting your plan' });

        // Keeps the connection open during a long generation
        const heartbeat = setInterval(() => {
          send({ type: 'step', id: 'generate', status: 'active', label: 'Drafting your plan' });
        }, 2500);

        let userMessage = buildUserMessage(profile, lifeEvent, customFunds);
        if (searchContext) {
          userMessage += `\n\nRESEARCH_CONTEXT (current data from internet search — use these numbers where relevant):\n${searchContext}`;
        }

        let textContent: string;
        try {
          textContent = await callGenerate(systemPrompt, userMessage);
        } finally {
          clearInterval(heartbeat);
        }
        if (!textContent) throw new Error('No text content in AI response');

        const rawResult = parsePathfinderResult(textContent);
        const actionsBeforeGuardrails = rawResult.quick_actions.length;

        log.push({
          step: 'Generate',
          detail: `Drafted ${actionsBeforeGuardrails} actions`,
          data: rawResult.quick_actions.map(a => a.title).join(' | '),
        });

        // Wait for pre-think to finish (likely already done by now)
        await preThinkPromise;

        send({
          type: 'step',
          id: 'generate',
          status: 'complete',
          label: 'Drafted your plan',
          detail: `${actionsBeforeGuardrails} steps`,
        });

        // Step 5: Guardrails
        send({ type: 'step', id: 'guardrails', status: 'active', label: 'Checking every dollar' });

        const result = applyPostParseGuardrails(rawResult, profile, customFunds, lifeEvent, rules, removedActions);

        if (removedActions.length > 0) {
          log.push({
            step: 'Guardrail',
            detail: `Removed ${removedActions.length}, kept ${result.quick_actions.length}`,
            data: removedActions.join(' | '),
          });
        }

        send({
          type: 'step',
          id: 'guardrails',
          status: 'complete',
          label: 'Checked every dollar',
          detail: `${result.quick_actions.length} of ${actionsBeforeGuardrails} steps passed`,
        });

        const debugLog = {
          entries: log,
          actionsBeforeGuardrails,
          actionsAfterGuardrails: result.quick_actions.length,
          removedActions,
        };

        // Final: send complete result
        send({ type: 'complete', result, searchMetadata, debugLog });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        send({ type: 'error', message });
      }

      close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      ...rateLimitHeaders(limit),
    },
  });
}
