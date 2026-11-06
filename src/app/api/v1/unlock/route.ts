import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GATE_COOKIE, gateProof } from '@/lib/gate';
import { sha256 } from '@/server/crypto';
import { ApiError, route } from '@/server/http';
import { takeToken } from '@/server/rate-limit';

const body = z.object({ password: z.string().min(1).max(200) });

const TRIES_A_DAY = 30;
const LIFETIME_SECONDS = 365 * 24 * 60 * 60;

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const POST = route(async (request) => {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) throw new ApiError(404, 'not_found', 'Not found.');

  const address = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  const allowed = await takeToken(`unlock:${sha256(address)}`, TRIES_A_DAY).catch(() => true);
  if (!allowed) throw new ApiError(429, 'too_many', 'Too many tries. Come back tomorrow.');

  const { password } = body.parse(await request.json());
  if (!same(password, expected)) throw new ApiError(401, 'wrong_password', "That's not it.");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE, await gateProof(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: LIFETIME_SECONDS,
  });
  return response;
});
