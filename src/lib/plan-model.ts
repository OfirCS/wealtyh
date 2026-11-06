import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const FAST_BETA = 'fast-mode-2026-02-01';

/**
 * A host with a short request limit can't wait for a live search and a normal draft. With this on,
 * plans skip the search and draft in fast mode: about 10 seconds instead of 25, at twice the price.
 */
export function quickPlans(): boolean {
  return process.env.PLAN_QUICK === 'on';
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  const block = message.content.find((item) => item.type === 'text');
  return block?.type === 'text' ? block.text : '';
}

/** Writes a whole plan. Throws if Claude can't, so the caller can try something else. */
export async function draftPlan(apiKey: string, system: string, userMessage: string): Promise<string> {
  const claude = new Anthropic({ apiKey });
  const request = (fast: boolean) => claude.beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: fast ? [FALLBACK_BETA, FAST_BETA] : [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: fast ? 'low' : 'medium' },
    ...(fast ? { speed: 'fast' } : {}),
    system,
    messages: [{ role: 'user', content: userMessage }],
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

  try {
    return textOf(await request(quickPlans()));
  } catch (error) {
    // Fast mode has its own, smaller rate limit. A slower plan beats none.
    if (quickPlans() && error instanceof Anthropic.RateLimitError) return textOf(await request(false));
    throw error;
  }
}
