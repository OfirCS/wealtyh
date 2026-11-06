import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Sighting } from '@/core/ledger/types';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** A family. The session points here, so people can share one budget later. */
export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Google's stable account id, once someone signs in. Empty for a household that hasn't. */
  googleSub: text('google_sub').unique(),
  /** The last sighting number handed out. Clients pull everything after the one they have. */
  seq: bigint('seq', { mode: 'number' }).notNull().default(0),
  plan: text('plan').notNull().default('free'),
  stripeCustomer: text('stripe_customer').unique(),
  createdAt: createdAt(),
});

export interface ConnectionAccount {
  id: string;
  name: string;
  mask?: string;
  type?: string;
}

export type ConnectionStatus = 'ok' | 'needs_login' | 'error';

/** One login at one bank, which may hold several accounts. */
export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  /** The provider's id for this login. Webhooks arrive with it. */
  itemId: text('item_id').notNull(),
  institution: text('institution').notNull(),
  accounts: jsonb('accounts').$type<ConnectionAccount[]>().notNull().default([]),
  /** The provider's access token, sealed. See crypto.ts. */
  secret: text('secret').notNull(),
  cursor: text('cursor'),
  status: text('status').$type<ConnectionStatus>().notNull().default('ok'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('connections_provider_item').on(table.provider, table.itemId),
  index('connections_household').on(table.householdId),
]);

/** What a source reported, untouched. Merging happens in the ledger, on the device. */
export const sightings = pgTable('sightings', {
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  /** Moves forward every time this row changes, so an update reaches clients too. */
  seq: bigint('seq', { mode: 'number' }).notNull(),
  connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'set null' }),
  data: jsonb('data').$type<Sighting>().notNull(),
  /** The source took it back, such as a pending charge that never posted. */
  removed: boolean('removed').notNull().default(false),
  createdAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.householdId, table.id] }),
  index('sightings_household_seq').on(table.householdId, table.seq),
]);

/** One document per household, so a second device opens the same budget. */
export const budgets = pgTable('budgets', {
  householdId: uuid('household_id').primaryKey().references(() => households.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** What an iPhone uses to post Apple Pay taps. Only a hash is kept. */
export const tapTokens = pgTable('tap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index('tap_tokens_household').on(table.householdId)]);

/** Shared by every server instance, unlike a counter in memory. */
export const rateBuckets = pgTable('rate_buckets', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

/** Who did what to a connection. No money or personal details. */
export const audit = pgTable('audit', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  householdId: uuid('household_id'),
  action: text('action').notNull(),
  createdAt: createdAt(),
}, (table) => [index('audit_household').on(table.householdId)]);
