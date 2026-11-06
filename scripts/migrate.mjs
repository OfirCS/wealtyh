#!/usr/bin/env node
// Runs at deploy, not at request time, so two servers waking up can't race.
// With no address there's nothing to do: PGlite migrates itself on first use.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] No database address, skipping');
  process.exit(0);
}

const client = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
await client.end();
console.log('[migrate] Done');
