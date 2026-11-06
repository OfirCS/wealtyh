import { describe, expect, it } from 'vitest';
import { answerSamePurchase, displayName, merchantWords, reconcile, sameMerchant, withdraw } from '@/core/ledger';
import type { Purchase, Sighting } from '@/core/ledger';

let nextId = 0;

function sighting(source: Sighting['source'], date: string, amountCents: number, merchant: string, extra: Partial<Sighting> = {}): Sighting {
  nextId += 1;
  const provider = { bank: 'plaid', statement: 'csv', wallet: 'shortcut', receipt: 'gmail', typed: 'typed' }[source];
  return { id: `${provider}:${nextId}`, source, provider, date, amountCents, currency: 'CAD', merchant, ...(source === 'bank' ? { accountId: 'card' } : {}), ...extra };
}

const bank = (date: string, cents: number, merchant: string, extra?: Partial<Sighting>) => sighting('bank', date, cents, merchant, extra);
const receipt = (date: string, cents: number, merchant: string, extra?: Partial<Sighting>) => sighting('receipt', date, cents, merchant, extra);
const tap = (date: string, cents: number, merchant: string, extra?: Partial<Sighting>) => sighting('wallet', date, cents, merchant, extra);
const statement = (date: string, cents: number, merchant: string, extra?: Partial<Sighting>) => sighting('statement', date, cents, merchant, extra);
const typed = (date: string, cents: number, merchant: string, extra?: Partial<Sighting>) => sighting('typed', date, cents, merchant, extra);

function fold(...batches: Sighting[][]): Purchase[] {
  return batches.reduce<Purchase[]>((purchases, batch) => reconcile(purchases, batch).purchases, []);
}

function only(purchases: Purchase[]): Purchase {
  expect(purchases).toHaveLength(1);
  return purchases[0];
}

describe('merchant names', () => {
  it.each([
    ['AMZN MKTP CA*ZX12A', 'Amazon.ca'],
    ['AMZN MKTP CA*ZX12A', 'Amazon'],
    ['SQ *JOES COFFEE', "Joe's Coffee"],
    ['TST* THE PIZZA PLACE', 'Pizza Place'],
    ['PAYPAL *SPOTIFY', 'Spotify'],
    ['TIM HORTONS #4410', 'Tim Hortons'],
    ['TIMS', 'Tim Hortons'],
    ['LOBLAWS 1234 TORONTO ON', 'Loblaws'],
    ['INSTACART*COSTCO TORONTO', 'Instacart Costco'],
    ['WAL-MART #3045', 'Walmart'],
    ['LCBO/RAO #0217', 'LCBO'],
    ['COSTCO WHOLESALE W1234', 'Costco'],
    ['THE HOME DEPOT #7042', 'Home Depot'],
    ['UBER *EATS', 'Uber Eats'],
    ['UBEREATS', 'UBER *EATS'],
    ['LONGOS BROOKFIELD PLACE', "Longo's Grocery Delivery"],
    ['Interac e-Transfer to Sam', 'E-TRANSFER SENT'],
  ])('%s is %s', (a, b) => {
    expect(sameMerchant(a, b)).toBe('yes');
    expect(sameMerchant(b, a)).toBe('yes');
  });

  it.each([
    ['UBER *EATS', 'UBER *TRIP'],
    ['Tim Hortons', 'Shell'],
    ['Esso', 'Shell'],
    ['Metro', 'Sobeys'],
    ['APPLE MUSIC', 'APPLE TV'],
  ])('%s is not %s', (a, b) => {
    expect(sameMerchant(a, b)).toBe('no');
  });

  it.each([
    ['POINT OF SALE INTERAC RETAIL PURCHASE', 'Tim Hortons'],
    ['VISA DEBIT PURCHASE', 'Shell'],
    ['Instacart', 'Loblaws'],
    ['PayPal', 'Etsy'],
    ['TIM HORTONS', 'TIM CHANG'],
  ])("can't tell %s from %s", (a, b) => {
    expect(sameMerchant(a, b)).toBe('unknown');
  });

  it('keeps a real name that happens to start like a place or a word to drop', () => {
    expect(merchantWords('CANADA POST')).toEqual(['CANADA', 'POST']);
    expect(merchantWords('Bell Canada')).toEqual(['BELL']);
  });

  it('cleans a bank name for showing', () => {
    expect(displayName('TIM HORTONS #4410 TORONTO ON')).toBe('Tim Hortons');
    expect(displayName('AMZN MKTP CA*ZX12A')).toBe('Amazon');
    expect(displayName('POS PURCHASE')).toBe('POS PURCHASE');
  });
});

describe('one purchase, many sightings', () => {
  it('folds a bank line and a receipt, each keeping what it knows best', () => {
    const purchase = only(fold([receipt('2026-11-01', 8421, "Longo's", { items: ['Milk'], categoryId: 'groceries' })], [bank('2026-11-03', 8421, 'LONGOS #12 TORONTO ON', { categoryId: 'shopping' })]));
    expect(purchase).toMatchObject({ amountCents: 8421, merchant: "Longo's", categoryId: 'groceries', items: ['Milk'], date: '2026-11-01' });
    expect(purchase.sightings).toHaveLength(2);
  });

  it('gives the same answer whichever came first', () => {
    const a = receipt('2026-11-01', 8421, "Longo's");
    const b = bank('2026-11-03', 8421, 'LONGOS #12 TORONTO ON');
    expect(only(fold([a], [b])).merchant).toBe(only(fold([b], [a])).merchant);
  });

  it('holds a tap, a receipt and a bank line together', () => {
    const purchase = only(fold([tap('2026-11-01', 2599, 'Winners')], [receipt('2026-11-01', 2599, 'Winners')], [bank('2026-11-02', 2599, 'WINNERS #220')]));
    expect(purchase.sightings.map((item) => item.source).sort()).toEqual(['bank', 'receipt', 'wallet']);
  });

  it('reads a bank posting late, but not a week late', () => {
    expect(fold([receipt('2026-11-01', 5000, 'Canadian Tire')], [bank('2026-11-06', 5000, 'CANADIAN TIRE #12')])).toHaveLength(1);
    expect(fold([receipt('2026-11-01', 5000, 'Canadian Tire')], [bank('2026-11-08', 5000, 'CANADIAN TIRE #12')])).toHaveLength(2);
  });

  it('allows a store to charge before it emails, only when store and amount both match', () => {
    expect(fold([bank('2026-11-01', 5000, 'NETFLIX.COM')], [receipt('2026-11-04', 5000, 'Netflix')])).toHaveLength(1);
    expect(fold([bank('2026-11-01', 5000, 'NETFLIX.COM')], [receipt('2026-11-05', 5000, 'Netflix')])).toHaveLength(2);
  });

  it('follows a tip', () => {
    const purchase = only(fold([receipt('2026-11-01', 4000, 'Pai Northern Thai')], [bank('2026-11-02', 4800, 'PAI NORTHERN THAI')]));
    expect(purchase.amountCents).toBe(4800);
  });

  it("won't call a big jump a tip, or match a tip across different stores", () => {
    expect(fold([receipt('2026-11-01', 4000, 'Pai')], [bank('2026-11-02', 6000, 'PAI')])).toHaveLength(2);
    expect(fold([receipt('2026-11-01', 4000, 'Pai')], [bank('2026-11-02', 4800, 'SHELL')])).toHaveLength(2);
  });

  it('matches a US receipt to the Canadian charge, at a believable rate', () => {
    const purchase = only(fold([receipt('2026-11-01', 1000, 'Anthropic', { currency: 'USD' })], [bank('2026-11-02', 1372, 'ANTHROPIC')]));
    expect(purchase).toMatchObject({ amountCents: 1372, currency: 'CAD' });
    expect(fold([receipt('2026-11-01', 1000, 'Anthropic', { currency: 'USD' })], [bank('2026-11-02', 2000, 'ANTHROPIC')])).toHaveLength(2);
  });

  it('never merges two purchases from one feed', () => {
    expect(fold([bank('2026-11-01', 525, 'TIM HORTONS #1'), bank('2026-11-01', 525, 'TIM HORTONS #1')])).toHaveLength(2);
    expect(fold([tap('2026-11-01', 525, 'Tim Hortons'), tap('2026-11-01', 525, 'Tim Hortons')])).toHaveLength(2);
  });

  it('pairs identical coffees one to one', () => {
    const purchases = fold([tap('2026-11-01', 525, 'Tim Hortons'), tap('2026-11-01', 525, 'Tim Hortons')], [bank('2026-11-02', 525, 'TIM HORTONS #1'), bank('2026-11-02', 525, 'TIM HORTONS #1')]);
    expect(purchases).toHaveLength(2);
    expect(purchases.every((purchase) => purchase.sightings.length === 2)).toBe(true);
  });

  it('keeps the same amount at two different stores apart', () => {
    expect(fold([receipt('2026-11-01', 1000, 'Metro')], [bank('2026-11-01', 1000, 'SHELL C0123')])).toHaveLength(2);
  });

  it('asks when a name says nothing, and keeps both until told', () => {
    const vague = bank('2026-11-02', 8421, 'POINT OF SALE INTERAC RETAIL PURCHASE');
    const first = reconcile([], [receipt('2026-11-01', 8421, "Longo's")]);
    const second = reconcile(first.purchases, [vague]);
    expect(second.purchases).toHaveLength(2);
    expect(second.questions).toHaveLength(1);
    expect(second.questions[0]).toMatchObject({ sighting: { id: vague.id }, purchaseId: first.purchases[0].id });

    expect(answerSamePurchase(second.purchases, second.questions[0], false)).toHaveLength(2);
    const joined = only(answerSamePurchase(second.purchases, second.questions[0], true));
    expect(joined).toMatchObject({ amountCents: 8421, merchant: "Longo's" });
    expect(joined.sightings).toHaveLength(2);
  });

  it('matches two records of one account without asking', () => {
    const result = reconcile(fold([bank('2026-11-02', 8421, 'POS PURCHASE')]), [statement('2026-11-03', 8421, 'IDP PURCHASE 8842')]);
    expect(result.purchases).toHaveLength(1);
    expect(result.questions).toHaveLength(0);
  });
});

describe('pending charges', () => {
  it('swaps pending for posted when the bank links them, whatever the amount', () => {
    const pending = bank('2026-11-01', 100, 'SHELL C0123', { pending: true });
    const posted = bank('2026-11-02', 6012, 'SHELL C0123', { replacesId: pending.id });
    const purchase = only(fold([pending], [posted]));
    expect(purchase).toMatchObject({ amountCents: 6012, pending: false });
    expect(purchase.sightings.map((item) => item.id)).toEqual([posted.id]);
  });

  it('ignores the pending row if the posted one got here first', () => {
    const pending = bank('2026-11-01', 100, 'SHELL', { pending: true });
    const posted = bank('2026-11-02', 6012, 'SHELL', { replacesId: pending.id });
    expect(only(fold([posted], [pending])).sightings.map((item) => item.id)).toEqual([posted.id]);
    expect(only(fold([posted, pending])).sightings.map((item) => item.id)).toEqual([posted.id]);
  });

  it('spots a pending row becoming posted with no link', () => {
    const purchase = only(fold([bank('2026-11-01', 4000, 'PAI', { pending: true })], [bank('2026-11-03', 4800, 'PAI')]));
    expect(purchase).toMatchObject({ amountCents: 4800, pending: false });
    expect(purchase.sightings).toHaveLength(1);
  });

  it('keeps a receipt when the bank line under it posts', () => {
    const pending = bank('2026-11-01', 4000, 'PAI', { pending: true });
    const purchase = only(fold([pending], [receipt('2026-11-01', 4000, 'Pai Northern Thai')], [bank('2026-11-02', 4800, 'PAI', { replacesId: pending.id })]));
    expect(purchase).toMatchObject({ amountCents: 4800, merchant: 'Pai Northern Thai' });
    expect(purchase.sightings).toHaveLength(2);
  });

  it('drops a charge the bank took back', () => {
    const pending = bank('2026-11-01', 4000, 'PAI', { pending: true });
    expect(withdraw(fold([pending]), [pending.id])).toHaveLength(0);
  });

  it('keeps the receipt if only the bank line was taken back', () => {
    const line = bank('2026-11-01', 4000, 'PAI');
    const purchases = fold([line], [receipt('2026-11-01', 4000, 'Pai')]);
    expect(only(withdraw(purchases, [line.id])).sightings).toHaveLength(1);
  });
});

describe('split orders', () => {
  it('folds one receipt and two charges', () => {
    const purchase = only(fold([receipt('2026-11-01', 10000, 'Amazon')], [bank('2026-11-03', 6000, 'AMZN MKTP CA*A1'), bank('2026-11-09', 4000, 'AMZN MKTP CA*B2')]));
    expect(purchase.amountCents).toBe(10000);
    expect(purchase.sightings).toHaveLength(3);
  });

  it('folds them when the charges come one at a time', () => {
    const purchases = fold([bank('2026-11-03', 6000, 'AMZN MKTP CA*A1')], [receipt('2026-11-01', 10000, 'Amazon')], [bank('2026-11-09', 4000, 'AMZN MKTP CA*B2')]);
    expect(only(purchases).amountCents).toBe(10000);
  });

  it('folds two receipts into one charge', () => {
    const purchase = only(fold([receipt('2026-11-01', 6000, 'Amazon'), receipt('2026-11-01', 4000, 'Amazon')], [bank('2026-11-03', 10000, 'AMZN MKTP CA*A1')]));
    expect(purchase.amountCents).toBe(10000);
    expect(purchase.sightings).toHaveLength(3);
  });

  it("won't force a sum across different stores or a long gap", () => {
    expect(fold([receipt('2026-11-01', 10000, 'Amazon')], [bank('2026-11-03', 6000, 'AMZN'), bank('2026-11-04', 4000, 'SHELL')])).toHaveLength(3);
    expect(fold([receipt('2026-11-01', 10000, 'Amazon')], [bank('2026-11-03', 6000, 'AMZN'), bank('2026-12-20', 4000, 'AMZN')])).toHaveLength(3);
  });
});

describe('refunds', () => {
  it('links a refund to what it refunds, and never calls it income', () => {
    const purchases = fold([bank('2026-10-20', 2499, 'WINNERS #1')], [bank('2026-11-01', -2499, 'WINNERS #1')]);
    const refund = purchases.find((purchase) => purchase.amountCents < 0);
    expect(refund).toMatchObject({ kind: 'refund', refundOf: purchases.find((purchase) => purchase.amountCents > 0)?.id });
  });

  it('links a partial refund to the closest purchase', () => {
    const big = bank('2026-10-20', 9000, 'WINNERS');
    const purchases = fold([big, bank('2026-10-01', 500, 'WINNERS')], [bank('2026-11-01', -2000, 'WINNERS')]);
    expect(purchases.find((purchase) => purchase.amountCents < 0)?.refundOf).toBe(big.id);
  });

  it('prefers the purchase with the exact amount', () => {
    const exact = bank('2026-10-01', 2000, 'WINNERS');
    const purchases = fold([exact, bank('2026-10-30', 9000, 'WINNERS')], [bank('2026-11-01', -2000, 'WINNERS')]);
    expect(purchases.find((purchase) => purchase.amountCents < 0)?.refundOf).toBe(exact.id);
  });

  it('counts a refund email and its bank credit once', () => {
    const purchases = fold([bank('2026-10-20', 2499, 'WINNERS')], [receipt('2026-11-01', -2499, 'Winners')], [bank('2026-11-03', -2499, 'WINNERS')]);
    expect(purchases).toHaveLength(2);
    expect(purchases.reduce((sum, purchase) => sum + purchase.amountCents, 0)).toBe(0);
  });

  it('never folds a refund into a purchase', () => {
    expect(fold([bank('2026-11-01', 2499, 'WINNERS')], [receipt('2026-11-01', -2499, 'Winners')])).toHaveLength(2);
  });
});

describe('moving your own money', () => {
  it('marks both legs of a card payment as a transfer', () => {
    const purchases = fold([bank('2026-11-01', 60000, 'VISA PAYMENT', { accountId: 'chequing' }), bank('2026-11-02', -60000, 'PAYMENT THANK YOU', { accountId: 'card', kind: 'transfer' })]);
    expect(purchases.map((purchase) => purchase.kind)).toEqual(['transfer', 'transfer']);
  });

  it("doesn't touch a same size purchase with no transfer in sight", () => {
    const purchases = fold([bank('2026-11-01', 60000, 'IKEA', { accountId: 'chequing' }), bank('2026-11-02', -60000, 'IKEA', { accountId: 'card' })]);
    expect(purchases.map((purchase) => purchase.kind).sort()).toEqual(['refund', 'spending']);
  });

  it('folds an e-Transfer email into its bank line', () => {
    expect(fold([receipt('2026-11-01', 5000, 'Interac e-Transfer to Sam')], [bank('2026-11-01', 5000, 'E-TRANSFER SENT')])).toHaveLength(1);
  });
});

describe('statements', () => {
  it('matches a statement to the bank, row by row, either way round', () => {
    const rows = [bank('2026-11-01', 525, 'TIM HORTONS #1'), bank('2026-11-01', 525, 'TIM HORTONS #1'), bank('2026-11-03', 7120, 'SHELL C01')];
    const lines = [statement('2026-11-02', 525, 'TIM HORTONS 1'), statement('2026-11-02', 525, 'TIM HORTONS 1'), statement('2026-11-04', 7120, 'SHELL C01')];
    expect(fold(rows, lines)).toHaveLength(3);
    expect(fold(lines, rows)).toHaveLength(3);
  });

  it('counts the same statement once as a CSV and once as a PDF', () => {
    expect(fold([statement('2026-11-01', 7120, 'SHELL')], [statement('2026-11-01', 7120, 'SHELL', { provider: 'pdf' })])).toHaveLength(1);
  });
});

describe('reading twice', () => {
  it('changes nothing when the same sightings come again', () => {
    const rows = [bank('2026-11-01', 525, 'TIM HORTONS'), receipt('2026-11-01', 525, 'Tim Hortons'), tap('2026-11-05', 9000, 'Shell')];
    const first = reconcile([], rows);
    const second = reconcile(first.purchases, rows);
    expect(second.purchases).toEqual(first.purchases);
    expect(second.added).toBe(0);
    expect(second.merged).toBe(0);
  });

  it('spots an email read again under a new id and a reworded store', () => {
    expect(fold([receipt('2026-11-01', 8421, 'Amazon')], [receipt('2026-11-01', 8421, 'Amazon.ca Order')])).toHaveLength(1);
  });

  it('keeps two separate receipts in the same read', () => {
    expect(fold([receipt('2026-11-01', 8421, 'Amazon'), receipt('2026-11-01', 8421, 'Amazon')])).toHaveLength(2);
  });

  it('folds the same receipt from two family inboxes', () => {
    expect(fold([receipt('2026-11-01', 8421, 'Amazon', { provider: 'gmail:a' })], [receipt('2026-11-01', 8421, 'Amazon', { provider: 'gmail:b' })])).toHaveLength(1);
  });

  it('updates a sighting the bank changed', () => {
    const line = bank('2026-11-01', 4000, 'PAI');
    expect(only(fold([line], [{ ...line, amountCents: 4400 }])).amountCents).toBe(4400);
  });
});

describe('what the user set', () => {
  const lockedPurchase = (): Purchase => ({ ...only(fold([receipt('2026-11-01', 5000, 'Shop', { categoryId: 'fun' })])), locked: ['categoryId', 'merchant', 'amountCents', 'date'], categoryId: 'kids', merchant: 'My name', amountCents: 4900, date: '2026-10-31' });

  it('survives every later sighting', () => {
    const { purchases } = reconcile([lockedPurchase()], [bank('2026-11-02', 5000, 'SHOP #1', { categoryId: 'shopping' })]);
    const purchase = purchases.find((item) => item.sightings.length > 1) ?? purchases[0];
    expect(purchase).toMatchObject({ categoryId: 'kids', merchant: 'My name', amountCents: 4900, date: '2026-10-31' });
  });

  it("doesn't bring back what was deleted", () => {
    const deleted = { ...only(fold([receipt('2026-11-01', 5000, 'Shop')])), removed: true };
    const { purchases, added } = reconcile([deleted], [bank('2026-11-02', 5000, 'SHOP #1')]);
    expect(added).toBe(0);
    expect(only(purchases).removed).toBe(true);
  });

  it('lets typed money give way to the bank', () => {
    const purchase = only(fold([typed('2026-11-01', 1200, 'Lunch at Pai')], [bank('2026-11-01', 1200, 'PAI')]));
    expect(purchase).toMatchObject({ amountCents: 1200, merchant: 'Lunch at Pai' });
  });
});

describe('a whole month in any order', () => {
  const month: Sighting[] = [
    bank('2026-11-01', 210000, 'LANDLORD RENT', { accountId: 'chequing', categoryId: 'housing' }),
    bank('2026-11-02', 2099, 'NETFLIX.COM'), receipt('2026-11-02', 2099, 'Netflix'),
    bank('2026-11-03', 18432, 'LOBLAWS 1234 TORONTO ON'), tap('2026-11-03', 18432, 'Loblaws'),
    bank('2026-11-05', 525, 'TIM HORTONS #4410'), tap('2026-11-05', 525, 'Tim Hortons'),
    bank('2026-11-05', 525, 'TIM HORTONS #4410'), tap('2026-11-05', 525, 'Tim Hortons'),
    bank('2026-11-08', 7120, 'SHELL C03214'), tap('2026-11-08', 7120, 'Shell'),
    bank('2026-11-10', 4800, 'PAI NORTHERN THAI'), receipt('2026-11-10', 4000, 'Pai Northern Thai'),
    bank('2026-11-12', 1372, 'ANTHROPIC'), receipt('2026-11-12', 1000, 'Anthropic', { currency: 'USD' }),
    receipt('2026-11-14', 10000, 'Amazon'), bank('2026-11-15', 6000, 'AMZN MKTP CA*A1'), bank('2026-11-18', 4000, 'AMZN MKTP CA*B2'),
    bank('2026-11-20', 2499, 'WINNERS #220'), receipt('2026-11-20', 2499, 'Winners'),
    bank('2026-11-25', -2499, 'WINNERS #220'), receipt('2026-11-24', -2499, 'Winners'),
    statement('2026-11-03', 18432, 'LOBLAWS 1234'), statement('2026-11-08', 7120, 'SHELL C03214'),
    bank('2026-11-27', 3845, 'LCBO/RAO #0217'),
  ];
  const expected = 210000 + 2099 + 18432 + 525 + 525 + 7120 + 4800 + 1372 + 10000 + 2499 - 2499 + 3845;

  function shuffled(seed: number): Sighting[] {
    let state = seed;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    return [...month].map((item) => ({ item, order: next() })).sort((a, b) => a.order - b.order).map(({ item }) => item);
  }

  const total = (purchases: Purchase[]) => purchases.reduce((sum, purchase) => sum + purchase.amountCents, 0);

  it('adds up in one read', () => {
    expect(total(fold(month))).toBe(expected);
  });

  it.each(Array.from({ length: 40 }, (_, index) => index + 1))('adds up one at a time, order %i', (seed) => {
    expect(total(fold(...shuffled(seed).map((item) => [item])))).toBe(expected);
  });

  it.each(Array.from({ length: 20 }, (_, index) => index + 1))('adds up in batches, order %i', (seed) => {
    const rows = shuffled(seed);
    const size = 1 + (seed % 7);
    const batches = Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
    expect(total(fold(...batches))).toBe(expected);
  });
});
