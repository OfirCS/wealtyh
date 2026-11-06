import { sql } from 'drizzle-orm';
import { getDb, schema } from './db';

const { rateBuckets } = schema;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One atomic statement, so every server instance shares the count. */
export async function takeToken(key: string, limit: number, windowMs = DAY_MS): Promise<boolean> {
  const db = await getDb();
  const resetAt = new Date(Date.now() + windowMs);
  const [row] = await db.insert(rateBuckets)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateBuckets.key,
      set: {
        count: sql`case when ${rateBuckets.resetAt} < now() then 1 else ${rateBuckets.count} + 1 end`,
        resetAt: sql`case when ${rateBuckets.resetAt} < now() then excluded.reset_at else ${rateBuckets.resetAt} end`,
      },
    })
    .returning({ count: rateBuckets.count });
  return row.count <= limit;
}
