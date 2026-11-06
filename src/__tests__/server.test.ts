// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

process.env.PGLITE_DIR = 'memory://';

const { open, seal } = await import('@/server/crypto');
const { parseTapAmount, sightingFromTap, recordTap, mintTapToken } = await import('@/server/wallet');
const { sightingFromPlaid } = await import('@/server/connectors/plaid');
const { readSightings, storeSightings } = await import('@/server/sightings');
const { takeToken } = await import('@/server/rate-limit');
const { getDb, schema } = await import('@/server/db');
const session = await import('@/app/api/v1/session/route');
const connections = await import('@/app/api/v1/connections/route');
const connect = await import('@/app/api/v1/bank/connect/route');
const link = await import('@/app/api/v1/bank/link-token/route');
const sync = await import('@/app/api/v1/sync/route');
const sightingsRoute = await import('@/app/api/v1/sightings/route');
const budget = await import('@/app/api/v1/budget/route');
const tapRoute = await import('@/app/api/v1/wallet/tap/route');
const stripeHook = await import('@/app/api/v1/webhooks/stripe/route');

const noParams = { params: Promise.resolve({}) } as never;
const ORIGIN = 'http://localhost:3003';

function request(path: string, init: { method?: string; body?: unknown; token?: string; origin?: string } = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3003',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.origin ? { origin: init.origin } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function household(): Promise<{ id: string; token: string }> {
  const response = await session.POST(request('/api/v1/session', { body: {} }), noParams);
  const data = await response.json() as { household: string; token: string };
  return { id: data.household, token: data.token };
}

async function pull(token: string, after = 0) {
  const response = await sightingsRoute.GET(request(`/api/v1/sightings?after=${after}`, { method: 'GET', token }), noParams);
  return response.json() as Promise<{ sightings: { id: string; amountCents: number; pending?: boolean }[]; removed: string[]; next: number; more: boolean }>;
}

beforeAll(async () => {
  await getDb();
});

describe('sealing bank tokens', () => {
  it('opens what it sealed, differently each time', () => {
    const first = seal('access-sandbox-123');
    expect(open(first)).toBe('access-sandbox-123');
    expect(seal('access-sandbox-123')).not.toBe(first);
    expect(first).not.toContain('access-sandbox');
  });

  it('refuses anything tampered with', () => {
    const sealed = seal('secret');
    const flipped = sealed.slice(0, -2) + (sealed.endsWith('AA') ? 'BB' : 'AA');
    expect(() => open(flipped)).toThrow();
    expect(() => open('nonsense')).toThrow();
  });
});

describe('reading Wallet amounts', () => {
  it.each([
    ['$12.34', 1234, 'CAD'],
    ['CA$12.34', 1234, 'CAD'],
    ['12,34 $', 1234, 'CAD'],
    ['$1,234.56', 123456, 'CAD'],
    ['US$9.99', 999, 'USD'],
    ['€10.00', 1000, 'EUR'],
    [8.5, 850, 'CAD'],
  ])('%s', (text, cents, currency) => {
    expect(parseTapAmount(text)).toEqual({ cents, currency });
  });

  it.each(['', 'free', '$0.00', '-'])('refuses %s', (text) => {
    expect(parseTapAmount(text)).toBeNull();
  });

  it('gives one tap the same id within a minute, and a new id after', () => {
    const tap = { amount: '$5.25', merchant: 'Tim Hortons' };
    const first = sightingFromTap('h', tap, new Date('2026-11-05T15:00:10Z'));
    const retry = sightingFromTap('h', tap, new Date('2026-11-05T15:00:40Z'));
    const later = sightingFromTap('h', tap, new Date('2026-11-05T15:05:00Z'));
    expect(retry?.id).toBe(first?.id);
    expect(later?.id).not.toBe(first?.id);
    expect(first).toMatchObject({ source: 'wallet', provider: 'shortcut', amountCents: 525, currency: 'CAD', date: '2026-11-05' });
  });

  it("dates a late night tap by Toronto's day", () => {
    const tap = sightingFromTap('h', { amount: '$5', merchant: 'Shell' }, new Date('2026-11-06T03:00:00Z'));
    expect(tap?.date).toBe('2026-11-05');
  });
});

describe('reading Plaid transactions', () => {
  const base = {
    transaction_id: 't1', account_id: 'a1', amount: 12.34, date: '2026-11-03', authorized_date: '2026-11-01',
    iso_currency_code: 'CAD', unofficial_currency_code: null, name: 'TIM HORTONS #123', merchant_name: 'Tim Hortons',
    pending: false, pending_transaction_id: null,
    personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE' },
  };
  const read = (change: object) => sightingFromPlaid({ ...base, ...change } as never);

  it('uses the day of the purchase and keeps money out positive', () => {
    expect(read({})).toMatchObject({ id: 'plaid:t1', source: 'bank', date: '2026-11-01', amountCents: 1234, merchant: 'Tim Hortons', kind: 'spending', categoryId: 'eating' });
  });

  it('falls back to the posted date and the raw name', () => {
    expect(read({ authorized_date: null, merchant_name: null })).toMatchObject({ date: '2026-11-03', merchant: 'TIM HORTONS #123' });
  });

  it('links a posted charge to its pending one', () => {
    expect(read({ pending_transaction_id: 'p9' })).toMatchObject({ replacesId: 'plaid:p9' });
  });

  it.each([
    [{ primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' }, 12.34, 'spending', 'groceries'],
    [{ primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT' }, 2100, 'spending', 'housing'],
    [{ primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_MORTGAGE_PAYMENT' }, 2100, 'spending', 'housing'],
    [{ primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' }, 500, 'transfer', undefined],
    [{ primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' }, 500, 'transfer', undefined],
    [{ primary: 'INCOME', detailed: 'INCOME_WAGES' }, -4000, 'income', undefined],
    [{ primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_OTHER' }, -20, 'refund', undefined],
  ])('sorts %o', (category, amount, kind, categoryId) => {
    const sighting = read({ personal_finance_category: category, amount });
    expect(sighting.kind).toBe(kind);
    expect(sighting.categoryId).toBe(categoryId);
  });
});

describe('storing sightings', () => {
  const row = (id: string, amountCents = 100) => ({ id, source: 'bank' as const, provider: 'plaid', date: '2026-11-01', amountCents, currency: 'CAD', merchant: 'Shop' });

  it('changes nothing when told the same thing twice', async () => {
    const { id } = await household();
    expect(await storeSightings({ householdId: id, upsert: [row('a'), row('b')] })).toBe(2);
    expect(await storeSightings({ householdId: id, upsert: [row('a'), row('b')] })).toBe(0);
    expect((await readSightings(id, 0)).sightings).toHaveLength(2);
  });

  it('sends a changed row again, and a removed one once', async () => {
    const { id } = await household();
    await storeSightings({ householdId: id, upsert: [row('a'), row('b')] });
    const { next } = await readSightings(id, 0);
    await storeSightings({ householdId: id, upsert: [row('a', 250)], removed: ['b'] });
    const page = await readSightings(id, next);
    expect(page.sightings.map((item) => [item.id, item.amountCents])).toEqual([['a', 250]]);
    expect(page.removed).toEqual(['b']);
    expect((await readSightings(id, page.next)).sightings).toHaveLength(0);
  });

  it('pages without losing anything', async () => {
    const { id } = await household();
    await storeSightings({ householdId: id, upsert: Array.from({ length: 7 }, (_, index) => row(`r${index}`)) });
    const first = await readSightings(id, 0, 3);
    const second = await readSightings(id, first.next, 3);
    const third = await readSightings(id, second.next, 3);
    expect([first.more, second.more, third.more]).toEqual([true, true, false]);
    expect([...first.sightings, ...second.sightings, ...third.sightings].map((item) => item.id)).toHaveLength(7);
  });

  it("never mixes one family's rows with another's", async () => {
    const one = await household();
    const two = await household();
    await storeSightings({ householdId: one.id, upsert: [row('same-id', 100)] });
    await storeSightings({ householdId: two.id, upsert: [row('same-id', 900)] });
    expect((await pull(one.token)).sightings[0].amountCents).toBe(100);
    expect((await pull(two.token)).sightings[0].amountCents).toBe(900);
  });
});

describe('a bank connection', () => {
  it('brings in history, then a pending charge posts with its tip', async () => {
    const { token } = await household();
    const links = await link.POST(request('/api/v1/bank/link-token', { body: {}, token }), noParams);
    expect(await links.json()).toMatchObject({ mode: 'mock' });

    const first = await connect.POST(request('/api/v1/bank/connect', { body: { publicToken: 'mock' }, token }), noParams);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: 'ok', connection: { institution: 'Test Bank' } });

    const history = await pull(token);
    expect(history.sightings.length).toBeGreaterThan(5);
    expect(history.sightings.find((item) => item.pending)?.amountCents).toBe(4000);

    await sync.POST(request('/api/v1/sync?force', { body: {}, token }), noParams);
    const update = await pull(token, history.next);
    expect(update.sightings.map((item) => item.amountCents)).toEqual([4800]);
    expect(update.removed).toHaveLength(1);
  });

  it('skips a second sync within a minute unless forced', async () => {
    const { token } = await household();
    await connect.POST(request('/api/v1/bank/connect', { body: { publicToken: 'mock' }, token }), noParams);
    const response = await sync.POST(request('/api/v1/sync', { body: {}, token }), noParams);
    expect(await response.json()).toEqual({ results: [] });
  });

  it('never shows the token, sealed or open', async () => {
    const { token } = await household();
    await connect.POST(request('/api/v1/bank/connect', { body: { publicToken: 'mock' }, token }), noParams);
    const response = await connections.GET(request('/api/v1/connections', { method: 'GET', token }), noParams);
    const text = await response.text();
    expect(text).toContain('Test Bank');
    expect(text).not.toContain('mock-access');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('v1.');
  });
});

describe('an Apple Pay tap', () => {
  it('reaches the household, once', async () => {
    const { id, token } = await household();
    const tap = await mintTapToken(id);
    const now = new Date('2026-11-05T15:00:00Z');
    await recordTap(tap, { amount: '$5.25', merchant: 'Tim Hortons' }, now);
    await recordTap(tap, { amount: '$5.25', merchant: 'Tim Hortons' }, now);
    expect((await pull(token)).sightings.map((item) => item.amountCents)).toEqual([525]);
  });

  it('counts a repeat once when the minute turns between the two', async () => {
    const { id } = await household();
    const token = await mintTapToken(id);
    const edge = Math.floor(Date.now() / 60_000) * 60_000;
    const tap = { amount: '$5.25', merchant: 'Tim Hortons' };
    await recordTap(token, tap, new Date(edge - 1000));
    await recordTap(token, tap, new Date(edge + 1000));
    expect((await readSightings(id, 0)).sightings).toHaveLength(1);
  });

  it('counts a second coffee a few minutes later', async () => {
    const { id } = await household();
    const token = await mintTapToken(id);
    const edge = Math.floor(Date.now() / 60_000) * 60_000;
    const tap = { amount: '$5.25', merchant: 'Tim Hortons' };
    await recordTap(token, tap, new Date(edge - 300_000));
    await recordTap(token, tap, new Date(edge));
    expect((await readSightings(id, 0)).sightings).toHaveLength(2);
  });

  it('takes the key from a link, and a form as well as JSON', async () => {
    const { id } = await household();
    const key = await mintTapToken(id);
    const form = new NextRequest(`${ORIGIN}/api/v1/wallet/tap?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'localhost:3003' },
      body: new URLSearchParams({ amount: '$7.25', merchant: 'Tim Hortons' }),
    });
    expect((await tapRoute.POST(form, noParams)).status).toBe(200);
    expect((await readSightings(id, 0)).sightings[0]).toMatchObject({ amountCents: 725, merchant: 'Tim Hortons', source: 'wallet' });
  });

  it('turns away a wrong, old or missing token', async () => {
    const { id } = await household();
    const old = await mintTapToken(id);
    await mintTapToken(id);
    const tap = (token?: string) => tapRoute.POST(request('/api/v1/wallet/tap', { body: { amount: '$1', merchant: 'Shop' }, token }), noParams);
    expect((await tap(old)).status).toBe(401);
    expect((await tap('pf_tap_nonsense')).status).toBe(401);
    expect((await tap('not-even-close')).status).toBe(401);
    expect((await tap()).status).toBe(401);
  });

  it('stores only a hash of the token', async () => {
    const { id } = await household();
    const tap = await mintTapToken(id);
    const db = await getDb();
    const rows = await db.select().from(schema.tapTokens);
    expect(JSON.stringify(rows)).not.toContain(tap);
  });

  it('refuses a body that makes no sense', async () => {
    const { id } = await household();
    const tap = await mintTapToken(id);
    const response = await tapRoute.POST(request('/api/v1/wallet/tap', { body: { amount: 'free', merchant: 'Shop' }, token: tap }), noParams);
    expect(response.status).toBe(400);
  });

  it.each([[{ amount: '', merchant: '' }], [{}]])('says connected on a test run from Shortcuts, and counts nothing: %j', async (body) => {
    const { id } = await household();
    const tap = await mintTapToken(id);
    const response = await tapRoute.POST(request('/api/v1/wallet/tap', { body, token: tap }), noParams);
    expect(response.status).toBe(200);
    expect((await response.json()).message).toContain('Connected');
    expect((await readSightings(id, 0)).sightings).toHaveLength(0);
  });

  it('turns away a test run with a wrong key', async () => {
    const response = await tapRoute.POST(request('/api/v1/wallet/tap', { body: { amount: '', merchant: '' }, token: 'pf_tap_nonsense' }), noParams);
    expect(response.status).toBe(401);
  });

  it('refuses a named purchase with no amount', async () => {
    const { id } = await household();
    const tap = await mintTapToken(id);
    const response = await tapRoute.POST(request('/api/v1/wallet/tap', { body: { amount: '', merchant: 'Shop' }, token: tap }), noParams);
    expect(response.status).toBe(400);
  });

  it.each([[''], [undefined], ['   ']])('keeps a purchase with the store name %j', async (merchant) => {
    const { id } = await household();
    const tap = await mintTapToken(id);
    const response = await tapRoute.POST(request('/api/v1/wallet/tap', { body: { amount: '$4.50', merchant }, token: tap }), noParams);
    expect(response.status).toBe(200);
    expect((await readSightings(id, 0)).sightings[0]).toMatchObject({ amountCents: 450, merchant: 'Card tap', source: 'wallet' });
  });

  it('shortens a very long name instead of losing the purchase', async () => {
    const { id } = await household();
    const tap = await mintTapToken(id);
    const response = await tapRoute.POST(request('/api/v1/wallet/tap', { body: { amount: '$4.50', merchant: 'x'.repeat(300) }, token: tap }), noParams);
    expect(response.status).toBe(200);
    expect((await readSightings(id, 0)).sightings[0].merchant).toHaveLength(120);
  });
});

describe('the budget document', () => {
  it('stops a stale device from overwriting a newer one', async () => {
    const { token } = await household();
    const put = (version: number, income: number) => budget.PUT(request('/api/v1/budget', { method: 'PUT', body: { version, data: { income } }, token }), noParams);
    expect(await (await put(0, 100)).json()).toEqual({ version: 1 });
    expect(await (await put(1, 200)).json()).toEqual({ version: 2 });
    expect((await put(1, 999)).status).toBe(409);
    const saved = await budget.GET(request('/api/v1/budget', { method: 'GET', token }), noParams);
    expect(await saved.json()).toEqual({ version: 2, data: { income: 200 } });
  });

  it('keeps the budget sealed in the database', async () => {
    const { id, token } = await household();
    await budget.PUT(request('/api/v1/budget', { method: 'PUT', body: { version: 0, data: { note: 'findable-in-plain-text' } }, token }), noParams);
    const db = await getDb();
    const rows = await db.select().from(schema.budgets);
    const row = rows.find((item) => item.householdId === id);
    expect(JSON.stringify(row)).not.toContain('findable-in-plain-text');
  });

  it("never shows one family's budget to another", async () => {
    const one = await household();
    const two = await household();
    await budget.PUT(request('/api/v1/budget', { method: 'PUT', body: { version: 0, data: { income: 100 } }, token: one.token }), noParams);
    const other = await budget.GET(request('/api/v1/budget', { method: 'GET', token: two.token }), noParams);
    expect(await other.json()).toEqual({ version: 0, data: null });
  });
});

describe('sessions', () => {
  it('turns away nobody by default, but needs a session for data', async () => {
    const response = await connections.GET(request('/api/v1/connections', { method: 'GET' }), noParams);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in first.' } });
  });

  it('keeps the same household on the same session', async () => {
    const { id, token } = await household();
    const again = await session.POST(request('/api/v1/session', { body: {}, token }), noParams);
    expect((await again.json()).household).toBe(id);
  });

  it('sets an HttpOnly cookie', async () => {
    const response = await session.POST(request('/api/v1/session', { body: {} }), noParams);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/pf_session=/);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('refuses a forged session', async () => {
    const { token } = await household();
    const forged = `${token.slice(0, -4)}AAAA`;
    const response = await connections.GET(request('/api/v1/connections', { method: 'GET', token: forged }), noParams);
    expect(response.status).toBe(401);
  });

  it('refuses a cookie write from another site', async () => {
    const response = await session.POST(request('/api/v1/session', { body: {}, origin: 'https://evil.example' }), noParams);
    expect(response.status).toBe(403);
  });
});

describe('the rate limit', () => {
  it('stops at the limit, per key', async () => {
    expect(await takeToken('k1', 2)).toBe(true);
    expect(await takeToken('k1', 2)).toBe(true);
    expect(await takeToken('k1', 2)).toBe(false);
    expect(await takeToken('k2', 2)).toBe(true);
  });

  it('starts over when the window ends', async () => {
    expect(await takeToken('k3', 1, -1000)).toBe(true);
    expect(await takeToken('k3', 1)).toBe(true);
  });
});

describe('signing in with Google', () => {
  const realFetch = globalThis.fetch;
  const asGoogle = (sub: string, aud = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ sub, aud }), { status: 200 })) as typeof fetch;
  };
  const signIn = async (token?: string) => {
    const response = await session.POST(request('/api/v1/session', { body: { googleAccessToken: 'google-token' }, token }), noParams);
    return { status: response.status, data: await response.json() as { household: string; token: string } };
  };

  beforeAll(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'our-app';
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('finds the same family from a second device', async () => {
    asGoogle('person-1');
    const phone = await signIn();
    const laptop = await signIn();
    expect(laptop.data.household).toBe(phone.data.household);
  });

  it('keeps what this device connected before signing in', async () => {
    const { id, token } = await household();
    asGoogle('person-2');
    expect((await signIn(token)).data.household).toBe(id);
  });

  it("never lets a second account take over someone's family", async () => {
    asGoogle('person-3');
    const first = await signIn();
    asGoogle('person-4');
    const second = await signIn(first.data.token);
    expect(second.data.household).not.toBe(first.data.household);
    asGoogle('person-3');
    expect((await signIn()).data.household).toBe(first.data.household);
  });

  it("refuses a token issued to someone else's app", async () => {
    asGoogle('person-5', 'another-app');
    expect((await signIn()).status).toBe(401);
  });
});

describe('plans', () => {
  const stripeEnv = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_MONTHLY: 'price_m', STRIPE_PRICE_YEARLY: 'price_y' };

  afterEach(() => {
    for (const key of Object.keys(stripeEnv)) delete process.env[key];
  });

  const connectBank = async (token: string) => link.POST(request('/api/v1/bank/link-token', { body: {}, token }), noParams);

  it('gives everyone everything until billing is on', async () => {
    const { token } = await household();
    expect((await connectBank(token)).status).toBe(200);
  });

  it('keeps bank logins for Family once billing is on', async () => {
    Object.assign(process.env, stripeEnv);
    const { token } = await household();
    const response = await connectBank(token);
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ error: { code: 'upgrade' } });
  });

  it('turns Family on and off from signed Stripe events only', async () => {
    Object.assign(process.env, stripeEnv);
    const Stripe = (await import('stripe')).default;
    const { id, token } = await household();
    const post = (payload: object, signature?: string) => {
      const body = JSON.stringify(payload);
      const header = signature ?? Stripe.webhooks.generateTestHeaderString({ payload: body, secret: stripeEnv.STRIPE_WEBHOOK_SECRET });
      return stripeHook.POST(new NextRequest(`${ORIGIN}/api/v1/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': header }, body }), noParams);
    };

    const paid = { id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: { client_reference_id: id, customer: `cus_${id}` } } };
    expect((await post(paid, 'forged')).status).toBe(401);
    expect((await connectBank(token)).status).toBe(402);

    expect((await post(paid)).status).toBe(200);
    expect((await connectBank(token)).status).toBe(200);

    const cancelled = { id: 'evt_2', object: 'event', type: 'customer.subscription.deleted', data: { object: { customer: `cus_${id}` } } };
    expect((await post(cancelled)).status).toBe(200);
    expect((await connectBank(token)).status).toBe(402);
  });
});
