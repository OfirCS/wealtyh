import { mkdirSync } from 'fs';
import path from 'path';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { env } from '../env';
import { ApiError } from '../http';
import * as schema from './schema';

/** PGlite speaks the same Postgres, so one type covers both. */
export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Kept on globalThis because hot reloading would otherwise open a second copy of the same files
const holder = globalThis as unknown as { pathfinderDb?: Promise<Db> };

async function openPostgres(url: string): Promise<Db> {
  const [{ drizzle }, { default: postgres }] = await Promise.all([import('drizzle-orm/postgres-js'), import('postgres')]);
  // Serverless functions each hold a connection, so stay small and let a pooler do the rest
  return drizzle(postgres(url, { max: 3, prepare: false }), { schema });
}

async function openLocal(dir: string): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  if (!dir.includes('://')) mkdirSync(dir, { recursive: true });
  const database = drizzle(new PGlite(dir), { schema });
  await migrate(database, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return database as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!holder.pathfinderDb) {
    const { DATABASE_URL, PGLITE_DIR } = env();
    if (!DATABASE_URL && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return Promise.reject(new ApiError(503, 'no_database', 'Connections need a database first.'));
    }
    holder.pathfinderDb = DATABASE_URL ? openPostgres(DATABASE_URL) : openLocal(PGLITE_DIR);
    holder.pathfinderDb.catch(() => { holder.pathfinderDb = undefined; });
  }
  return holder.pathfinderDb;
}

export { schema };
