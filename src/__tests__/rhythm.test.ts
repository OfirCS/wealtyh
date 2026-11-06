import { describe, expect, it } from 'vitest';
import { readAnswer, rhythmLines } from '@/lib/budget-agent';
import { autoBudget, importStatement, monthSummary, purchaseRhythms, removeCategory, setMerchantRhythm, sortTransfersToPeople, togglePinned, typicalSpending, updateTransaction, yearSummary } from '@/lib/budget';
import type { Budget, Transaction } from '@/lib/budget';
import { monthHeadline, monthPicture } from '@/lib/month-picture';

const TODAY = '2026-11-20';

function buy(id: string, date: string, description: string, amount: number, categoryId: string, extra: Partial<Transaction> = {}): Transaction {
  return { id, date, description, amount, categoryId, sure: true, ...extra };
}

function budgetOf(transactions: Transaction[], extra: Partial<Budget> = {}): Budget {
  return { income: 0, categories: [], merchantRules: {}, transactions: [...transactions].sort((a, b) => a.date.localeCompare(b.date)), ...extra };
}

const family = budgetOf([
  buy('rent-9', '2026-09-01', 'Maple Properties', 2300, 'housing'),
  buy('rent-10', '2026-10-01', 'Maple Properties', 2300, 'housing'),
  buy('rent-11', '2026-11-01', 'Maple Properties', 2300, 'housing'),
  buy('food-9', '2026-09-10', 'Loblaws', 400, 'groceries'),
  buy('food-10', '2026-10-10', 'Loblaws', 500, 'groceries'),
  buy('food-11', '2026-11-10', 'Loblaws', 450, 'groceries'),
  buy('sofa', '2026-10-12', 'Article Furniture', 1800, 'shopping'),
  buy('friend', '2026-11-03', 'Dana Cole (e-Transfer)', 250, 'people'),
  buy('cleaner-10', '2026-10-05', 'Rosa Diaz (e-Transfer)', 120, 'people'),
  buy('cleaner-11', '2026-11-05', 'Rosa Diaz (e-Transfer)', 120, 'people'),
]);

describe('what each purchase is', () => {
  const rhythms = purchaseRhythms(family);

  it('finds a bill from the same amount each month', () => {
    expect(rhythms.get('rent-11')).toBe('bill');
  });

  it('keeps food as everyday spending, however much it changes', () => {
    expect(rhythms.get('food-11')).toBe('everyday');
  });

  it('sets aside a big purchase that never came back', () => {
    expect(rhythms.get('sofa')).toBe('once');
  });

  it('sets aside a single e-Transfer, but not one that repeats', () => {
    expect(rhythms.get('friend')).toBe('once');
    expect(rhythms.get('cleaner-11')).toBe('bill');
  });

  it('leaves small one-offs as ordinary spending', () => {
    const small = budgetOf([buy('socks', '2026-11-02', 'Uniqlo', 24, 'shopping')]);
    expect(purchaseRhythms(small).get('socks')).toBe('everyday');
  });

  it('takes the word of whoever read the receipt', () => {
    const read = budgetOf([buy('tv', '2026-11-02', 'Costco', 90, 'groceries', { once: true })]);
    expect(purchaseRhythms(read).get('tv')).toBe('once');
  });

  it('lets the agent overrule the rules, and the user overrule the agent', () => {
    const judged = { ...family, rhythms: { 'ARTICLE FURNITURE': 'everyday' as const } };
    expect(purchaseRhythms(judged).get('sofa')).toBe('everyday');
    expect(purchaseRhythms(setMerchantRhythm(judged, 'Article Furniture', 'once')).get('sofa')).toBe('once');
  });

  it("files a merchant the agent calls a bill, even on its first charge", () => {
    const first = budgetOf([buy('phone', '2026-11-02', 'Rogers', 90, 'bills')], { rhythms: { ROGERS: 'bill' } });
    expect(purchaseRhythms(first).get('phone')).toBe('bill');
    expect(monthPicture(first, '2026-11', TODAY).bills.map((bill) => bill.name)).toEqual(['Rogers']);
  });

  it('remembers a choice on one purchase', () => {
    const kept = updateTransaction(family, 'sofa', { once: false });
    expect(purchaseRhythms(kept).get('sofa')).toBe('everyday');
    const setApart = updateTransaction(family, 'food-11', { once: true });
    expect(purchaseRhythms(setApart).get('food-11')).toBe('once');
  });

  it('puts a refund wherever its purchase went', () => {
    const refunded = budgetOf([...family.transactions, buy('back', '2026-10-20', 'Article Furniture', -1800, 'shopping', { refundOf: 'sofa' })]);
    expect(purchaseRhythms(refunded).get('back')).toBe('once');
  });
});

describe('the budget', () => {
  it('builds amounts from what repeats, not from one-offs', () => {
    expect(typicalSpending(family).shopping).toBeUndefined();
    expect(autoBudget(family).categories.map((category) => category.id)).not.toContain('shopping');
  });

  it('still counts a one-off as money spent, apart from the budget', () => {
    const summary = monthSummary(family, '2026-10');
    expect(summary.oneTime).toBe(1800);
    expect(summary.spent).toBe(2920);
    expect(summary.spentByCategory.shopping).toBeUndefined();
  });

  it('shows one-offs on their own line of the year', () => {
    expect(yearSummary(family, 2026).once).toEqual({ '2026-10': 1800, '2026-11': 250 });
  });

  it('survives a later import', () => {
    const { budget } = importStatement([{ date: '2026-11-15', description: 'Ikea', amount: 900, once: true }], autoBudget(family), 0);
    expect(purchaseRhythms(budget).get(budget.transactions.find((item) => item.description === 'Ikea')!.id)).toBe('once');
  });

  it('moves old e-Transfers out of Other, unless the user put them there', () => {
    const old = budgetOf([
      buy('a', '2026-10-02', 'Dana Cole (e-Transfer)', 80, 'other', { sure: false }),
      buy('b', '2026-10-03', 'Sam Roy (e-Transfer)', 90, 'other', { locked: ['categoryId'] }),
    ]);
    const moved = sortTransfersToPeople(old).transactions;
    expect(moved[0]).toMatchObject({ categoryId: 'people', sure: true });
    expect(moved[1].categoryId).toBe('other');
  });
});

describe('a month at a glance', () => {
  const budget = autoBudget(family);
  const picture = monthPicture(budget, '2026-11', TODAY);

  it('lists bills with what is paid', () => {
    expect(picture.bills.map((bill) => [bill.name, bill.paid])).toEqual([['Maple Properties', true], ['Rosa Diaz (e-transfer)', true]]);
    expect(picture.billsPaid).toBe(2420);
  });

  it('shows a bill still to come, with its date', () => {
    const coming = monthPicture(budgetOf(family.transactions.filter((item) => item.id !== 'rent-11')), '2026-11', '2026-11-02');
    expect(coming.bills.find((bill) => bill.name === 'Maple Properties')).toMatchObject({ paid: false, amount: 2300 });
  });

  it("doesn't expect a bill that stopped months ago", () => {
    const stopped = budgetOf([
      buy('gym-1', '2026-05-22', 'Goodlife Fitness', 50, 'health'),
      buy('gym-2', '2026-06-22', 'Goodlife Fitness', 50, 'health'),
    ]);
    expect(monthPicture(stopped, '2026-11', TODAY).bills).toEqual([]);
  });

  it('takes bills out of everyday, so nothing counts twice', () => {
    expect(picture.everyday.find((row) => row.id === 'groceries')).toMatchObject({ spent: 450 });
    expect(picture.everyday.some((row) => row.id === 'housing')).toBe(false);
  });

  it('keeps one-offs apart, newest first', () => {
    expect(picture.oneTime.map((item) => item.id)).toEqual(['friend']);
    expect(picture.oneTimeTotal).toBe(250);
    expect(picture.left).toBe(picture.planned - picture.spent);
  });

  it('leads with what can still be spent, once the bills to come are covered', () => {
    const coming = monthPicture(budgetOf(family.transactions.filter((item) => item.id !== 'rent-11'), { categories: [{ id: 'housing', name: 'Housing', planned: 2300 }, { id: 'groceries', name: 'Groceries', planned: 600 }] }), '2026-11', '2026-11-02');
    const rows = coming.everyday.reduce((sum, row) => sum + Math.round(row.left), 0);
    expect(coming.spendable).toBe(Math.min(rows, coming.left - (coming.billsTotal - coming.billsPaid)));
    expect(monthHeadline(coming, '2026-11', '2026-11-02').label).toBe('left after bills');
  });

  it('judges a finished month by the whole budget', () => {
    expect(monthHeadline(picture, '2026-10', TODAY)).toMatchObject({ label: picture.left >= 0 ? 'under budget' : 'over budget', amount: Math.abs(picture.left), rate: null });
  });

  it('says how much that is a day', () => {
    const roomy = { ...picture, spendable: 900 };
    expect(monthHeadline(roomy, '2026-11', '2026-11-01')).toEqual({ amount: 900, label: 'left after bills', rate: '$30 a day', over: false });
  });

  it('skips the daily figure on the last day, and when it rounds to nothing', () => {
    expect(monthHeadline({ ...picture, spendable: 90 }, '2026-11', '2026-11-30').rate).toBeNull();
    expect(monthHeadline({ ...picture, spendable: 0 }, '2026-11', '2026-11-20').rate).toBeNull();
  });

  it('says when a new month starts, once it has gone over', () => {
    const over = { ...picture, spendable: -120 };
    expect(monthHeadline(over, '2026-11', '2026-11-05')).toEqual({ amount: 120, label: 'over budget', rate: 'new month in 26 days', over: true });
    expect(monthHeadline(over, '2026-11', '2026-11-30').rate).toBe('new month tomorrow');
  });
});

describe('what the agent gets to read', () => {
  it('leaves out plain groceries, but not a strange amount', () => {
    const lines = rhythmLines(budgetOf([
      buy('a', '2026-10-02', 'Loblaws', 80, 'groceries'),
      buy('b', '2026-10-02', 'Air Canada', 640, 'transport'),
      buy('c', '2026-10-05', 'Rosa Diaz (e-Transfer)', 120, 'people'),
    ]));
    expect(lines).toEqual(['Air Canada | Transport | 2026-10-02 640.00', 'Rosa Diaz (e-Transfer) | E-transfers | 2026-10-05 120.00']);
  });

  it('can look at only the payees that changed', () => {
    expect(rhythmLines(family, new Set(['ROSA DIAZ']))).toHaveLength(1);
  });
});

describe('changing the budget by hand', () => {
  const budget = { ...autoBudget(family), categories: [{ id: 'groceries', name: 'Groceries', planned: 400 }, { id: 'fun', name: 'Fun', planned: 900 }] };

  it('keeps a pinned category on top', () => {
    const today = monthPicture(budget, '2026-11', TODAY).everyday.map((row) => row.id);
    expect(today[0]).toBe('fun');
    expect(monthPicture(togglePinned(budget, 'groceries'), '2026-11', TODAY).everyday[0].id).toBe('groceries');
    expect(togglePinned(togglePinned(budget, 'groceries'), 'groceries').pinned).toEqual([]);
  });

  it('removes a category but never its purchases', () => {
    const removed = removeCategory(budget, 'groceries');
    expect(removed.categories.map((category) => category.id)).toEqual(['fun', 'other']);
    expect(removed.transactions.find((item) => item.id === 'food-11')).toMatchObject({ categoryId: 'other', amount: 450 });
  });
});

describe('an answer from Ask', () => {
  it('lifts the number out and drops markdown', () => {
    expect(readAnswer('**$0**: there are no Amazon purchases so far this month.')).toEqual({ figure: '$0', words: 'There are no Amazon purchases so far this month.' });
    expect(readAnswer('$1,234.50 on groceries since September.')).toEqual({ figure: '$1,234.50', words: 'On groceries since September.' });
  });

  it('leaves a plain sentence alone', () => {
    expect(readAnswer('Your **gym** looks unused.')).toEqual({ figure: null, words: 'Your gym looks unused.' });
  });
});
