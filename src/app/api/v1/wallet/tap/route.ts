import type { NextRequest } from 'next/server';
import { unauthorized, route } from '@/server/http';
import { recordTap } from '@/server/wallet';

const CONNECTED = 'Connected. Pay with Apple Pay and it lands in your budget.';

/** A link is one thing to paste on a phone. The key only ever lets someone add a tap. */
function keyFrom(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return request.nextUrl.searchParams.get('key');
}

/** Shortcuts sends JSON or a form, depending on how the action is set up. */
async function bodyOf(request: NextRequest): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('form')) return request.json();
  return Object.fromEntries((await request.formData()).entries());
}

export const POST = route(async (request) => {
  const key = keyFrom(request);
  if (!key) throw unauthorized();
  const result = await recordTap(key, await bodyOf(request));
  return result === 'test' ? { ok: true, message: CONNECTED } : { ok: true };
});
