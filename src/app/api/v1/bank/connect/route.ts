import { z } from 'zod';
import { requireHousehold } from '@/server/auth/session';
import { activeConnector } from '@/server/connectors';
import { seal } from '@/server/crypto';
import { getDb, schema } from '@/server/db';
import { ApiError, route } from '@/server/http';
import { syncConnection } from '@/server/sync';

const { audit, connections } = schema;

const body = z.object({ publicToken: z.string().min(1).max(512) });

export const POST = route(async (request) => {
  const household = await requireHousehold(request);
  const { publicToken } = body.parse(await request.json());
  const connector = activeConnector();
  if (!connector) throw new ApiError(503, 'no_bank', 'Bank connections are off.');

  const login = await connector.exchange(publicToken);
  const db = await getDb();
  const [connection] = await db.insert(connections).values({
    householdId: household,
    provider: connector.name,
    itemId: login.itemId,
    institution: login.institution,
    accounts: login.accounts,
    secret: seal(login.accessToken),
  }).returning();
  await db.insert(audit).values({ householdId: household, action: `connect:${connector.name}` });

  const result = await syncConnection(connection);
  return { connection: { id: connection.id, institution: connection.institution, accounts: connection.accounts }, ...result };
});
