import { NextRequest, NextResponse } from 'next/server';
import { generateThinkingPreview } from '@/lib/pathfinder-engine';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { validatePathfinderInput } from '@/lib/validate-request';

export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const validation = validatePathfinderInput(raw);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  try {
    const thinking_steps = await generateThinkingPreview(
      validation.profile,
      validation.lifeEvent,
      validation.customFunds,
    );
    return NextResponse.json({ thinking_steps }, { headers: rateLimitHeaders(limit) });
  } catch (err) {
    console.error('[Think API] Error:', err);
    return NextResponse.json({ thinking_steps: [] });
  }
}
