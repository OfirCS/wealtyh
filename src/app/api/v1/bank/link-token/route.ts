import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireHousehold } from '@/server/auth/session';
import { requireBankRoom } from '@/server/billing';
import { activeConnector, connectorFor } from '@/server/connectors';
import { open } from '@/server/crypto';
import { getDb, schema } from '@/server/db';
import { ApiError, notFound, route } from '@/server/http';

const { connections } = schema;

const body = z.object({ relink: z.string().uuid().optional() });

export const POST = route(async (request) => {
  const household = await requireHousehold(request);
  const { relink } = body.parse(await request.json().catch(() => ({})));
  if (relink) {
    const db = await getDb();
    const [connection] = await db.select().from(connections).where(and(eq(connections.id, relink), eq(connections.householdId, household)));
    if (!connection) throw notFound();
    return connectorFor(connection.provider).createLink(household, open(connection.secret));
  }
  const connector = activeConnector();
  if (!connector) throw new ApiError(503, 'no_bank', 'Bank connections are off.');
  await requireBankRoom(household);
  return connector.createLink(household);
});
