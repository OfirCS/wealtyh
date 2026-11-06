import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '../db';
import { env, sessionSecret } from '../env';
import { ApiError, unauthorized } from '../http';

const COOKIE = 'pf_session';
const LIFETIME_DAYS = 365;

function key(): Uint8Array {
  return new TextEncoder().encode(sessionSecret());
}

export function issueSession(householdId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(householdId)
    .setIssuedAt()
    .setExpirationTime(`${LIFETIME_DAYS}d`)
    .sign(key());
}

async function verify(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function bearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/** The web keeps its session in a cookie, and a phone app sends the same token as a header. */
export async function readHousehold(request: NextRequest): Promise<string | null> {
  const token = bearer(request) ?? request.cookies.get(COOKIE)?.value;
  return token ? verify(token) : null;
}

export async function requireHousehold(request: NextRequest): Promise<string> {
  const household = await readHousehold(request);
  if (!household) throw unauthorized();
  return household;
}

export function setSessionCookie(request: NextRequest, response: NextResponse, token: string): void {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: LIFETIME_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE);
}

/**
 * Asks Google who a token belongs to and which app it was issued to. Without the second check,
 * any other site the person signed in to could use its token to get in here.
 */
async function googleAccount(accessToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken }),
  });
  const info = (await response.json().catch(() => null)) as { aud?: string; sub?: string } | null;
  const clientId = env().NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!response.ok || !info?.sub || !clientId || info.aud !== clientId) {
    throw new ApiError(401, 'bad_google_token', "Google didn't confirm that sign-in.");
  }
  return info.sub;
}

/** The household for this request: the existing one, the one tied to this Google account, or a new one. */
export async function findOrCreateHousehold(current: string | null, googleAccessToken?: string): Promise<string> {
  const db = await getDb();
  if (!googleAccessToken) {
    if (current) return current;
    const [created] = await db.insert(schema.households).values({}).returning({ id: schema.households.id });
    return created.id;
  }

  const sub = await googleAccount(googleAccessToken);
  const [known] = await db.select({ id: schema.households.id }).from(schema.households).where(eq(schema.households.googleSub, sub));
  if (known) return known.id;

  // First sign-in on this household keeps whatever it already connected
  if (current) {
    const [claimed] = await db.update(schema.households).set({ googleSub: sub })
      .where(and(eq(schema.households.id, current), isNull(schema.households.googleSub)))
      .returning({ id: schema.households.id });
    if (claimed) return claimed.id;
  }
  const [created] = await db.insert(schema.households).values({ googleSub: sub }).returning({ id: schema.households.id });
  return created.id;
}
