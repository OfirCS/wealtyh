import { eq } from 'drizzle-orm';
import { requireHousehold } from '@/server/auth/session';
import { activeConnector } from '@/server/connectors';
import { getDb, schema } from '@/server/db';
import { route } from '@/server/http';

const { connections, tapTokens } = schema;

export const GET = route(async (request) => {
  const household = await requireHousehold(request);
  const db = await getDb();
  const rows = await db.select({
    id: connections.id,
    provider: connections.provider,
    institution: connections.institution,
    accounts: connections.accounts,
    status: connections.status,
    syncedAt: connections.syncedAt,
  }).from(connections).where(eq(connections.householdId, household));
  const [tap] = await db.select({ usedAt: tapTokens.usedAt }).from(tapTokens).where(eq(tapTokens.householdId, household));
  return {
    bank: activeConnector()?.name ?? null,
    connections: rows,
    wallet: tap ? { connected: true, lastTap: tap.usedAt } : { connected: false, lastTap: null },
  };
});
