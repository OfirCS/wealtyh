import type { NextRequest } from 'next/server';

// In-memory IP-bucket limiter. Survives only within a single serverless instance,
// but Vercel reuses warm functions enough that this still meaningfully throttles
// abuse without external infra. Move to Upstash KV if traffic warrants.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let dayStart = Date.now();
let dayCount = 0;

const PER_IP_LIMIT = Number(process.env.RATE_LIMIT_PER_IP_DAILY ?? 20);
const GLOBAL_DAILY_CAP = Number(process.env.RATE_LIMIT_GLOBAL_DAILY ?? 1000);
const DAY_MS = 24 * 60 * 60 * 1000;

function getIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export interface RateLimitResult {
  ok: boolean;
  reason?: 'per_ip' | 'global';
  retryAfterSeconds?: number;
  remaining?: number;
}

export function checkRateLimit(req: NextRequest): RateLimitResult {
  const now = Date.now();

  if (now - dayStart > DAY_MS) {
    dayStart = now;
    dayCount = 0;
    buckets.clear();
  }

  if (dayCount >= GLOBAL_DAILY_CAP) {
    const retryAfterSeconds = Math.ceil((dayStart + DAY_MS - now) / 1000);
    return { ok: false, reason: 'global', retryAfterSeconds };
  }

  const ip = getIp(req);
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: dayStart + DAY_MS });
    dayCount++;
    return { ok: true, remaining: PER_IP_LIMIT - 1 };
  }

  if (bucket.count >= PER_IP_LIMIT) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { ok: false, reason: 'per_ip', retryAfterSeconds };
  }

  bucket.count++;
  dayCount++;
  return { ok: true, remaining: PER_IP_LIMIT - bucket.count };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof result.remaining === 'number') {
    headers['X-RateLimit-Remaining'] = String(Math.max(0, result.remaining));
    headers['X-RateLimit-Limit'] = String(PER_IP_LIMIT);
  }
  if (result.retryAfterSeconds) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}
