import { randomBytes } from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import type { Sighting } from '@/core/ledger/types';
import { sha256 } from './crypto';
import { getDb, schema } from './db';
import { ApiError, unauthorized } from './http';
import { takeToken } from './rate-limit';
import { storeSightings } from './sightings';

const { sightings, tapTokens } = schema;

const PREFIX = 'pf_tap_';
const TAPS_PER_DAY = 200;
/** An automation can fire twice for one tap. The same tap within a minute counts once. */
const SAME_TAP_MS = 60_000;
/** Some terminals send no store name. The money still left, so the purchase still counts. */
const NO_NAME = 'Card tap';
const LONGEST_NAME = 120;

export const tapBody = z.object({
  amount: z.union([z.string().max(40), z.number()]),
  merchant: z.string().optional().transform((name) => name?.trim().slice(0, LONGEST_NAME) || NO_NAME),
  card: z.string().max(80).optional(),
  name: z.string().max(120).optional(),
});

export type TapBody = z.infer<typeof tapBody>;

export interface TapAmount {
  cents: number;
  currency: string;
}

/** Wallet writes amounts the way the phone is set: $12.34, CA$12.34, US$9.99 or 12,34 $. */
export function parseTapAmount(value: string | number): TapAmount | null {
  const text = String(value).trim();
  const number = Number(text.replace(/,(\d{2})(?!\d)/, '.$1').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(number) || number <= 0) return null;
  const cents = Math.round(number * 100);
  const foreign = text.match(/\b(US|EUR|GBP|USD)\b|US\$|€|£/i)?.[0].toUpperCase();
  const currency = !foreign ? 'CAD' : foreign.startsWith('US') ? 'USD' : foreign === '€' || foreign === 'EUR' ? 'EUR' : 'GBP';
  return { cents, currency };
}

/** Shown once, then only its hash exists. Making a new one retires the old one. */
export async function mintTapToken(householdId: string): Promise<string> {
  const token = `${PREFIX}${randomBytes(32).toString('base64url')}`;
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(tapTokens).where(eq(tapTokens.householdId, householdId));
    await tx.insert(tapTokens).values({ tokenHash: sha256(token), householdId });
  });
  return token;
}

async function householdForToken(token: string): Promise<string> {
  if (!token.startsWith(PREFIX)) throw unauthorized();
  const db = await getDb();
  const [row] = await db.update(tapTokens).set({ usedAt: new Date() }).where(eq(tapTokens.tokenHash, sha256(token))).returning({ householdId: tapTokens.householdId });
  if (!row) throw unauthorized();
  return row.householdId;
}

function torontoDate(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

export function sightingFromTap(householdId: string, tap: TapBody, now: Date): Sighting | null {
  const amount = parseTapAmount(tap.amount);
  if (!amount) return null;
  const minute = Math.floor(now.getTime() / SAME_TAP_MS);
  const fingerprint = sha256([householdId, minute, amount.cents, tap.merchant.toLowerCase()].join('|')).slice(0, 24);
  return {
    id: `shortcut:${fingerprint}`,
    source: 'wallet',
    provider: 'shortcut',
    date: torontoDate(now),
    amountCents: amount.cents,
    currency: amount.currency,
    merchant: tap.merchant,
    kind: 'spending',
  };
}

/** Ids change as the clock's minute turns, so a repeat can land just past that edge. */
async function justCounted(householdId: string, tap: TapBody, now: Date): Promise<boolean> {
  const window = new Date(now.getTime() - SAME_TAP_MS);
  const earlier = sightingFromTap(householdId, tap, window);
  if (!earlier) return false;
  const db = await getDb();
  const [row] = await db.select({ id: sightings.id }).from(sightings)
    .where(and(eq(sightings.householdId, householdId), eq(sightings.id, earlier.id), gt(sightings.createdAt, window)));
  return Boolean(row);
}

/** The play button in Shortcuts sends empty fields. That proves the link, and isn't a purchase. */
function isTestRun(body: unknown): boolean {
  const { amount, merchant } = (body ?? {}) as { amount?: unknown; merchant?: unknown };
  return !amount && !merchant;
}

export async function recordTap(token: string, body: unknown, now = new Date()): Promise<'counted' | 'test'> {
  const householdId = await householdForToken(token);
  if (isTestRun(body)) return 'test';
  if (!await takeToken(`tap:${householdId}`, TAPS_PER_DAY)) throw new ApiError(429, 'too_many', 'Too many taps today.');
  const tap = tapBody.parse(body);
  const sighting = sightingFromTap(householdId, tap, now);
  if (!sighting) throw new ApiError(400, 'bad_amount', "That amount didn't read.");
  if (await justCounted(householdId, tap, now)) return 'counted';
  await storeSightings({ householdId, upsert: [sighting] });
  return 'counted';
}
