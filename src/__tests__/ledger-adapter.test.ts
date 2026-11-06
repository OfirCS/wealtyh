import { describe, expect, it } from 'vitest';
import type { Sighting } from '@/core/ledger';
import { deleteTransaction, importStatement, monthSummary, updateTransaction } from '@/lib/budget';
import type { Budget } from '@/lib/budget';
import { answerQuestion, rowsFromSightings, withdrawSightings } from '@/lib/ledger-adapter';

const MONTH = '2026-11';

function bank(id: string, date: string, amountCents: number, merchant: string, extra: Partial<Sighting> = {}): Sighting {
  return { id: `plaid:${id}`, source: 'bank', provider: 'plaid', accountId: 'card', date, amountCents, currency: 'CAD', merchant, kind: amountCents < 0 ? 'refund' : 'spending', ...extra };
}

function fromBank(sightings: Sighting[], existing: Budget | null = null) {
  return importStatement(rowsFromSightings(sightings), existing, 0, 'bank');
}

const receipt = { date: '2026-11-03', description: "Longo's", amount: 84.21, emailed: true, category: 'groceries' };

describe('bank rows in the budget', () => {
  it('cleans the name and keeps dollars in the budget, cents in the ledger', () => {
    const { budget } = fromBank([bank('1', '2026-11-03', 8421, 'LONGOS #12 TORONTO ON')]);
    expect(budget.transactions[0]).toMatchObject({ description: 'Longos', amount: 84.21, source: 'bank' });
    expect(budget.transactions[0].sightings?.[0]).toMatchObject({ amountCents: 8421, merchant: 'LONGOS #12 TORONTO ON' });
  });

  it('counts a transfer and income outside spending', () => {
    const { budget } = fromBank([
      bank('1', '2026-11-03', 60000, 'VISA PAYMENT', { kind: 'transfer' }),
      bank('2', '2026-11-04', -420000, 'PAYROLL', { kind: 'income' }),
      bank('3', '2026-11-05', 1000, 'METRO', { categoryId: 'groceries' }),
    ]);
    expect(monthSummary(budget, MONTH).spent).toBe(10);
  });

  it('never turns a refund into income', () => {
    const { budget } = fromBank([bank('1', '2026-11-03', -2499, 'ZZQ UNKNOWN STORE')]);
    expect(budget.transactions[0].categoryId).not.toBe('income');
  });
});

describe('sources meeting', () => {
  it('folds a bank line into a receipt already in the budget', () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    const { budget, summary } = fromBank([bank('1', '2026-11-04', 8421, 'LONGOS #12')], first);
    expect(budget.transactions).toHaveLength(1);
    expect(summary).toMatchObject({ count: 0, repeats: 1 });
    expect(budget.transactions[0]).toMatchObject({ description: "Longo's", categoryId: 'groceries' });
    expect(budget.transactions[0].sightings).toHaveLength(2);
  });

  it('keeps the merge after being saved and loaded', () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    const merged = fromBank([bank('1', '2026-11-04', 8421, 'LONGOS #12')], first).budget;
    const reloaded = JSON.parse(JSON.stringify(merged)) as Budget;
    const again = fromBank([bank('1', '2026-11-04', 8421, 'LONGOS #12')], reloaded);
    expect(again.budget.transactions).toHaveLength(1);
    expect(again.summary.count).toBe(0);
  });

  it('works on rows saved before sightings existed', () => {
    const old: Budget = {
      income: 0,
      categories: [],
      merchantRules: {},
      transactions: [{ id: '2026-11-03|Metro|50', date: '2026-11-03', description: 'Metro', amount: 50, categoryId: 'groceries', sure: true, source: 'mail' }],
    };
    expect(fromBank([bank('1', '2026-11-04', 5000, 'METRO #12')], old).budget.transactions).toHaveLength(1);
  });

  it('follows a pending charge to its final amount', () => {
    const pending = bank('p', '2026-11-03', 4000, 'PAI', { pending: true });
    const first = fromBank([pending]).budget;
    expect(first.transactions[0].pending).toBe(true);
    const { budget } = fromBank([bank('q', '2026-11-04', 4800, 'PAI', { replacesId: pending.id })], first);
    expect(budget.transactions).toHaveLength(1);
    expect(budget.transactions[0]).toMatchObject({ amount: 48 });
    expect(budget.transactions[0].pending).toBeUndefined();
  });

  it('drops a charge the bank took back', () => {
    const pending = bank('p', '2026-11-03', 4000, 'PAI', { pending: true });
    const first = fromBank([pending]).budget;
    expect(withdrawSightings(first, [pending.id]).transactions).toHaveLength(0);
  });
});

describe('what the user did', () => {
  it('survives a later bank line', () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    const id = first.transactions[0].id;
    const edited = updateTransaction(first, id, { categoryId: 'fun', amount: 80 });
    const { budget } = fromBank([bank('1', '2026-11-04', 8421, 'LONGOS #12', { categoryId: 'shopping' })], edited);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'fun', amount: 80 });
  });

  it("doesn't bring back a deleted purchase when the bank reports it", () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    const without = deleteTransaction(first, first.transactions[0].id);
    const { budget, summary } = fromBank([bank('1', '2026-11-04', 8421, 'LONGOS #12')], without);
    expect(budget.transactions).toHaveLength(0);
    expect(summary.count).toBe(0);
  });
});

describe('same purchase questions', () => {
  const setUp = () => {
    const first = importStatement([receipt], null, 0, 'mail').budget;
    return fromBank([bank('1', '2026-11-04', 8421, 'POINT OF SALE INTERAC RETAIL PURCHASE')], first).budget;
  };

  it('asks, and keeps both until answered', () => {
    const budget = setUp();
    expect(budget.transactions).toHaveLength(2);
    expect(budget.questions).toHaveLength(1);
  });

  it('folds them on yes', () => {
    const budget = setUp();
    const answered = answerQuestion(budget, budget.questions![0], true);
    expect(answered.transactions).toHaveLength(1);
    expect(answered.questions).toHaveLength(0);
    expect(monthSummary(answered, MONTH).spent).toBeCloseTo(84.21);
  });

  it('leaves both on no, and stops asking', () => {
    const budget = setUp();
    const answered = answerQuestion(budget, budget.questions![0], false);
    expect(answered.transactions).toHaveLength(2);
    expect(answered.questions).toHaveLength(0);
  });
});
