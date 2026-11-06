import { and, eq } from 'drizzle-orm';
import { requireHousehold } from '@/server/auth/session';
import { connectorFor } from '@/server/connectors';
import { open } from '@/server/crypto';
import { getDb, schema } from '@/server/db';
import { notFound, route } from '@/server/http';

const { audit, connections } = schema;

export const DELETE = route<{ id: string }>(async (request, { params }) => {
  const household = await requireHousehold(request);
  const { id } = await params;
  const db = await getDb();
  const [connection] = await db.select().from(connections).where(and(eq(connections.id, id), eq(connections.householdId, household)));
  if (!connection) throw notFound();
  await connectorFor(connection.provider).disconnect(open(connection.secret));
  await db.delete(connections).where(eq(connections.id, id));
  await db.insert(audit).values({ householdId: household, action: `disconnect:${connection.provider}` });
  return { ok: true };
});
