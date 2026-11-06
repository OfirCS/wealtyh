import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireHousehold } from '@/server/auth/session';
import { open, seal } from '@/server/crypto';
import { getDb, schema } from '@/server/db';
import { ApiError, route } from '@/server/http';

const { budgets } = schema;

const MAX_BYTES = 5_000_000;
const body = z.object({ version: z.number().int().min(0), data: z.object({}).passthrough() });

export const GET = route(async (request) => {
  const household = await requireHousehold(request);
  const db = await getDb();
  const [row] = await db.select().from(budgets).where(eq(budgets.householdId, household));
  if (!row) return { version: 0, data: null };
  return { version: row.version, data: JSON.parse(open((row.data as { sealed: string }).sealed)) };
});

/** Two devices can't overwrite each other: the second one is told to pull first. */
export const PUT = route(async (request) => {
  const household = await requireHousehold(request);
  const text = await request.text();
  if (text.length > MAX_BYTES) throw new ApiError(413, 'too_large', 'That budget is too large.');
  const { version, data } = body.parse(JSON.parse(text));
  const sealed = { sealed: seal(JSON.stringify(data)) };
  const db = await getDb();
  const next = version + 1;
  const [saved] = await db.insert(budgets)
    .values({ householdId: household, version: next, data: sealed })
    .onConflictDoUpdate({ target: budgets.householdId, set: { version: next, data: sealed, updatedAt: new Date() }, setWhere: sql`${budgets.version} = ${version}` })
    .returning({ version: budgets.version });
  if (!saved) throw new ApiError(409, 'stale', 'This budget changed on another device.');
  return { version: saved.version };
});
