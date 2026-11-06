import { and, eq, lt, or, isNull } from 'drizzle-orm';
import { connectorFor } from './connectors';
import { open } from './crypto';
import { getDb, schema } from './db';
import type { ConnectionStatus } from './db/schema';
import { storeSightings } from './sightings';

const { connections } = schema;

/** Banks don't change by the minute, and every call to a provider counts. */
const MIN_GAP_MS = 60_000;

type Connection = typeof connections.$inferSelect;

export interface SyncResult {
  id: string;
  institution: string;
  status: ConnectionStatus;
  /** How many sightings changed. */
  changed: number;
  /** The bank is still preparing history, so ask again shortly. */
  notReady: boolean;
}

async function setStatus(id: string, status: ConnectionStatus): Promise<void> {
  const db = await getDb();
  await db.update(connections).set({ status }).where(eq(connections.id, id));
}

export async function syncConnection(connection: Connection): Promise<SyncResult> {
  const summary = { id: connection.id, institution: connection.institution };
  try {
    const page = await connectorFor(connection.provider).sync(open(connection.secret), connection.cursor);
    if (page.needsLogin) {
      await setStatus(connection.id, 'needs_login');
      return { ...summary, status: 'needs_login', changed: 0, notReady: false };
    }

    const changed = await storeSightings({
      householdId: connection.householdId,
      connectionId: connection.id,
      upsert: [...page.added, ...page.modified],
      removed: page.removed,
    });
    // The cursor moves only after the rows are safe, so a crash re-reads rather than loses
    const db = await getDb();
    await db.update(connections).set({ cursor: page.cursor, status: 'ok', syncedAt: new Date() }).where(eq(connections.id, connection.id));
    return { ...summary, status: 'ok', changed, notReady: page.notReady };
  } catch (error) {
    console.error('[sync] failed', connection.provider, error instanceof Error ? error.name : 'unknown');
    await setStatus(connection.id, 'error');
    return { ...summary, status: 'error', changed: 0, notReady: false };
  }
}

/** Skips anything synced in the last minute, unless forced. */
export async function syncHousehold(householdId: string, force = false): Promise<SyncResult[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - MIN_GAP_MS);
  const due = force
    ? eq(connections.householdId, householdId)
    : and(eq(connections.householdId, householdId), or(isNull(connections.syncedAt), lt(connections.syncedAt, cutoff)));
  const rows = await db.select().from(connections).where(due);
  return Promise.all(rows.map(syncConnection));
}

export async function syncItem(provider: string, itemId: string): Promise<void> {
  const db = await getDb();
  const [connection] = await db.select().from(connections).where(and(eq(connections.provider, provider), eq(connections.itemId, itemId)));
  if (connection) await syncConnection(connection);
}

export async function syncEverything(): Promise<number> {
  const db = await getDb();
  const rows = await db.select().from(connections).where(eq(connections.status, 'ok'));
  await Promise.all(rows.map(syncConnection));
  return rows.length;
}
