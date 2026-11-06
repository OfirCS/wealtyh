import { NextRequest, NextResponse } from 'next/server';
import { runPathfinder } from '@/lib/pathfinder-engine';
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
    const { result, searchMetadata, debugLog } = await runPathfinder(
      validation.profile,
      validation.lifeEvent,
      validation.customFunds,
    );
    return NextResponse.json({ result, searchMetadata, debugLog }, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Pathfinder API] Error:', message);
    return NextResponse.json({ error: 'Pathfinder failed to generate a plan. Please try again.' }, { status: 500 });
  }
}
