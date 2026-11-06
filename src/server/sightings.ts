import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Sighting } from '@/core/ledger/types';
import { getDb, schema } from './db';
import type { Tx } from './db';

const { households, sightings } = schema;

const DEFAULT_PAGE = 500;
const MAX_PAGE = 1000;

/** Hands out the next numbers for one household. The row lock keeps them in commit order. */
async function reserve(tx: Tx, householdId: string, count: number): Promise<number> {
  const [row] = await tx.update(households).set({ seq: sql`${households.seq} + ${count}` }).where(eq(households.id, householdId)).returning({ seq: households.seq });
  return row.seq - count + 1;
}

/** Postgres reorders JSON keys, so compare without caring about order. */
function fingerprint(sighting: Sighting): string {
  return JSON.stringify(Object.entries(sighting).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
}

interface Change {
  householdId: string;
  connectionId?: string;
  /** New or changed. Storing the same thing again does nothing and costs no sequence number. */
  upsert: Sighting[];
  removed?: string[];
}

export async function storeSightings({ householdId, connectionId, upsert, removed = [] }: Change): Promise<number> {
  if (upsert.length === 0 && removed.length === 0) return 0;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ids = [...new Set([...upsert.map((row) => row.id), ...removed])];
    const known = await tx.select().from(sightings).where(and(eq(sightings.householdId, householdId), inArray(sightings.id, ids)));
    const byId = new Map(known.map((row) => [row.id, row]));

    const fresh = new Map<string, Sighting>();
    for (const row of upsert) {
      const before = byId.get(row.id);
      if (!before || before.removed || fingerprint(before.data) !== fingerprint(row)) fresh.set(row.id, row);
    }
    const gone = removed.filter((id) => byId.has(id) && !byId.get(id)?.removed && !fresh.has(id));
    const total = fresh.size + gone.length;
    if (total === 0) return 0;

    let seq = await reserve(tx, householdId, total);
    for (const data of fresh.values()) {
      await tx.insert(sightings)
        .values({ householdId, id: data.id, seq, connectionId, data })
        .onConflictDoUpdate({ target: [sightings.householdId, sightings.id], set: { seq, data, removed: false } });
      seq += 1;
    }
    for (const id of gone) {
      await tx.update(sightings).set({ seq, removed: true }).where(and(eq(sightings.householdId, householdId), eq(sightings.id, id)));
      seq += 1;
    }
    return total;
  });
}

export interface SightingsPage {
  sightings: Sighting[];
  removed: string[];
  /** Pass this as `after` next time. */
  next: number;
  more: boolean;
}

export async function readSightings(householdId: string, after: number, limit = DEFAULT_PAGE): Promise<SightingsPage> {
  const size = Math.min(Math.max(1, limit), MAX_PAGE);
  const db = await getDb();
  const rows = await db.select().from(sightings)
    .where(and(eq(sightings.householdId, householdId), gt(sightings.seq, after)))
    .orderBy(asc(sightings.seq))
    .limit(size + 1);
  const page = rows.slice(0, size);
  return {
    sightings: page.filter((row) => !row.removed).map((row) => row.data),
    removed: page.filter((row) => row.removed).map((row) => row.id),
    next: page.at(-1)?.seq ?? after,
    more: rows.length > size,
  };
}
