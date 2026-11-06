import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GATE_COOKIE, gateProof } from '@/lib/gate';

/** These prove themselves with a token or a signature, or hold nothing private. */
const OPEN = ['/unlock', '/privacy', '/terms', '/api/v1/unlock', '/api/v1/wallet/tap', '/api/v1/webhooks/', '/api/v1/cron/', '/manifest.webmanifest', '/sw.js', '/icon', '/apple-touch-icon'];

/** Keeps the whole site private while SITE_PASSWORD is set. With it unset, the site is open. */
export async function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (OPEN.some((path) => pathname.startsWith(path))) return NextResponse.next();
  if (request.cookies.get(GATE_COOKIE)?.value === await gateProof(password)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { code: 'locked', message: 'This site is private.' } }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/unlock', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
