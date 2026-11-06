import { createHash, timingSafeEqual } from 'crypto';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid';
import type { RemovedTransaction, Transaction } from 'plaid';
import type { MoneyKind, Sighting } from '@/core/ledger/types';
import { env } from '../env';
import { unauthorized } from '../http';
import type { BankConnector, SyncPage } from './types';

const PROVIDER = 'plaid';
const HISTORY_DAYS = 365;
const PAGE_SIZE = 500;
/** The list can change while paging. Plaid's answer is to start that sync over. */
const MAX_RESTARTS = 3;
const WEBHOOK_MAX_AGE_SECONDS = 5 * 60;

function client(): PlaidApi {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = env();
  return new PlaidApi(new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: { headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET, 'Plaid-Version': '2020-09-14' } },
  }));
}

export function plaidReady(): boolean {
  const { PLAID_CLIENT_ID, PLAID_SECRET } = env();
  return Boolean(PLAID_CLIENT_ID && PLAID_SECRET);
}

function plaidError(error: unknown): string | null {
  const data = (error as { response?: { data?: { error_code?: string } } }).response?.data;
  return data?.error_code ?? null;
}

const PRIMARY_CATEGORIES: Record<string, string> = {
  BANK_FEES: 'bills',
  ENTERTAINMENT: 'fun',
  GENERAL_MERCHANDISE: 'shopping',
  HOME_IMPROVEMENT: 'shopping',
  MEDICAL: 'health',
  PERSONAL_CARE: 'health',
  RENT_AND_UTILITIES: 'bills',
  TRANSPORTATION: 'transport',
  TRAVEL: 'fun',
  LOAN_PAYMENTS: 'debt',
  FOOD_AND_DRINK: 'eating',
};

const DETAILED_CATEGORIES: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: 'groceries',
  RENT_AND_UTILITIES_RENT: 'housing',
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'housing',
};

const TO_A_PERSON = /e-?\s?transfer|\binterac\b/i;

/** Money sent to someone else looks like a transfer to the bank, but it's real spending. */
function sentToPerson(transaction: Transaction): boolean {
  return transaction.amount > 0 && transaction.personal_finance_category?.primary === 'TRANSFER_OUT' && TO_A_PERSON.test(`${transaction.merchant_name ?? ''} ${transaction.name}`);
}

function moneyKind(transaction: Transaction): MoneyKind {
  const { primary, detailed } = transaction.personal_finance_category ?? {};
  if (sentToPerson(transaction)) return 'spending';
  if (primary === 'TRANSFER_IN' || primary === 'TRANSFER_OUT' || detailed === 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT') return 'transfer';
  if (primary === 'INCOME') return 'income';
  return transaction.amount < 0 ? 'refund' : 'spending';
}

function category(transaction: Transaction): string | undefined {
  if (sentToPerson(transaction)) return 'people';
  const { primary, detailed } = transaction.personal_finance_category ?? {};
  if (detailed && DETAILED_CATEGORIES[detailed]) return DETAILED_CATEGORIES[detailed];
  return primary ? PRIMARY_CATEGORIES[primary] : undefined;
}

/** Plaid reports money out as positive, the same sign the budget uses. */
export function sightingFromPlaid(transaction: Transaction): Sighting {
  const kind = moneyKind(transaction);
  return {
    id: `${PROVIDER}:${transaction.transaction_id}`,
    source: 'bank',
    provider: PROVIDER,
    accountId: transaction.account_id,
    // The day of the purchase, not the day it posted, which can be days later
    date: transaction.authorized_date ?? transaction.date,
    amountCents: Math.round(transaction.amount * 100),
    currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code ?? 'CAD',
    merchant: transaction.merchant_name || transaction.name,
    pending: transaction.pending,
    ...(transaction.pending_transaction_id ? { replacesId: `${PROVIDER}:${transaction.pending_transaction_id}` } : {}),
    kind,
    ...(kind === 'spending' ? { categoryId: category(transaction) } : {}),
  };
}

function removedId(removed: RemovedTransaction): string {
  return `${PROVIDER}:${removed.transaction_id}`;
}

async function readAll(api: PlaidApi, accessToken: string, start: string | null): Promise<SyncPage> {
  const page: SyncPage = { added: [], modified: [], removed: [], cursor: start, needsLogin: false, notReady: false };
  let hasMore = true;
  while (hasMore) {
    const { data } = await api.transactionsSync({ access_token: accessToken, count: PAGE_SIZE, ...(page.cursor ? { cursor: page.cursor } : {}) });
    page.added.push(...data.added.map(sightingFromPlaid));
    page.modified.push(...data.modified.map(sightingFromPlaid));
    page.removed.push(...data.removed.map(removedId));
    page.cursor = data.next_cursor;
    hasMore = data.has_more;
    if (data.transactions_update_status === 'NOT_READY') page.notReady = true;
  }
  return page;
}

export const plaid: BankConnector = {
  name: 'plaid',

  async createLink(householdId, accessToken) {
    const { PUBLIC_URL } = env();
    const { data } = await client().linkTokenCreate({
      client_name: 'Pathfinder',
      language: 'en',
      country_codes: [CountryCode.Ca],
      user: { client_user_id: householdId },
      ...(accessToken ? { access_token: accessToken } : { products: [Products.Transactions], transactions: { days_requested: HISTORY_DAYS } }),
      // Plaid can't reach this machine, and the app syncs on open anyway
      ...(PUBLIC_URL ? { webhook: `${PUBLIC_URL}/api/v1/webhooks/plaid` } : {}),
    });
    return { linkToken: data.link_token, mode: 'plaid' };
  },

  async exchange(publicToken) {
    const api = client();
    const { data: login } = await api.itemPublicTokenExchange({ public_token: publicToken });
    const { data } = await api.accountsGet({ access_token: login.access_token });
    return {
      accessToken: login.access_token,
      itemId: login.item_id,
      institution: data.item.institution_name ?? 'Your bank',
      accounts: data.accounts.map((account) => ({ id: account.account_id, name: account.name, mask: account.mask ?? undefined, type: account.subtype ?? account.type })),
    };
  },

  async sync(accessToken, cursor) {
    const api = client();
    for (let attempt = 0; ; attempt++) {
      try {
        return await readAll(api, accessToken, cursor);
      } catch (error) {
        const code = plaidError(error);
        if (code === 'ITEM_LOGIN_REQUIRED') return { added: [], modified: [], removed: [], cursor, needsLogin: true, notReady: false };
        if (code !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' || attempt >= MAX_RESTARTS) throw error;
      }
    }
  },

  async disconnect(accessToken) {
    await client().itemRemove({ access_token: accessToken });
  },
};

/** Anyone can post to the webhook address, so only a body signed by Plaid gets through. */
export async function verifyPlaidWebhook(jwt: string | null, body: string): Promise<void> {
  if (!jwt) throw unauthorized();
  const { alg, kid } = decodeProtectedHeader(jwt);
  if (alg !== 'ES256' || !kid) throw unauthorized();
  const { data } = await client().webhookVerificationKeyGet({ key_id: kid });
  const key = await importJWK(data.key as unknown as Parameters<typeof importJWK>[0], 'ES256');
  const { payload } = await jwtVerify(jwt, key, { algorithms: ['ES256'], maxTokenAge: WEBHOOK_MAX_AGE_SECONDS });
  const claimed = Buffer.from(String(payload.request_body_sha256 ?? ''));
  const actual = Buffer.from(createHash('sha256').update(body).digest('hex'));
  if (claimed.length !== actual.length || !timingSafeEqual(claimed, actual)) throw unauthorized();
}
