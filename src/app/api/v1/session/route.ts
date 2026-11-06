import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearSessionCookie, findOrCreateHousehold, issueSession, readHousehold, setSessionCookie } from '@/server/auth/session';
import { sha256 } from '@/server/crypto';
import { isProduction } from '@/server/env';
import { ApiError, route } from '@/server/http';
import { takeToken } from '@/server/rate-limit';

const body = z.object({ googleAccessToken: z.string().min(1).max(4096).optional() });

/** New households are free to make, so a script mustn't be able to make millions. */
const NEW_HOUSEHOLDS_A_DAY = 40;

export const POST = route(async (request) => {
  const { googleAccessToken } = body.parse(await request.json().catch(() => ({})));
  const current = await readHousehold(request);
  if (!current && isProduction()) {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
    if (!await takeToken(`new:${sha256(address)}`, NEW_HOUSEHOLDS_A_DAY)) throw new ApiError(429, 'too_many', 'Try again tomorrow.');
  }
  const household = await findOrCreateHousehold(current, googleAccessToken);
  const token = await issueSession(household);
  const response = NextResponse.json({ household, token });
  setSessionCookie(request, response, token);
  return response;
});

export const DELETE = route(async () => {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
