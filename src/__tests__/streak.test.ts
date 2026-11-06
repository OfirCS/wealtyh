import { describe, expect, it } from 'vitest';
import { agentInsights, monthlyRenewals, upcomingBills } from '@/lib/agent-insights';
import { emptyBudget, importStatement } from '@/lib/budget';
import type { Budget, Transaction } from '@/lib/budget';
import { cleanAgentRows } from '@/lib/statement';
import { readPace, readStreak, recordCheckIn } from '@/lib/streak';

const days = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => `2026-11-${String(first + index).padStart(2, '0')}`);

describe('the streak', () => {
  it('counts days in a row', () => {
    expect(readStreak(days(1, 5), '2026-11-05')).toMatchObject({ days: 5, best: 5, checkedInToday: true });
  });

  it('starts at nothing', () => {
    expect(readStreak(undefined, '2026-11-05')).toMatchObject({ days: 0, best: 0, shields: 0, checkedInToday: false });
  });

  it('gives you until the end of today', () => {
    expect(readStreak(days(1, 4), '2026-11-05')).toMatchObject({ days: 4, checkedInToday: false });
  });

  it('ends when you miss a day with no shield', () => {
    expect(readStreak([...days(1, 3), ...days(5, 6)], '2026-11-06')).toMatchObject({ days: 2, best: 3 });
  });

  it('earns a shield every seven days', () => {
    expect(readStreak(days(1, 7), '2026-11-07').shields).toBe(1);
    expect(readStreak(days(1, 14), '2026-11-14').shields).toBe(2);
  });

  it('never holds more than two shields', () => {
    const longRun = Array.from({ length: 30 }, (_, index) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10));
    expect(readStreak(longRun, '2026-10-30').shields).toBe(2);
  });

  it('spends a shield to cover a missed day', () => {
    const streak = readStreak([...days(1, 7), ...days(9, 10)], '2026-11-10');
    expect(streak).toMatchObject({ days: 9, shields: 0 });
  });

  it('ends after more missed days than shields', () => {
    expect(readStreak([...days(1, 7), ...days(10, 10)], '2026-11-10').days).toBe(1);
  });

  it('counts a day once, however many times you look', () => {
    const once = recordCheckIn(emptyBudget(), '2026-11-05');
    expect(recordCheckIn(once, '2026-11-05')).toBe(once);
    expect(once.checkIns).toEqual(['2026-11-05']);
  });
});

function budgetWith(transactions: Partial<Transaction>[]): Budget {
  return {
    ...emptyBudget(),
    categories: [{ id: 'groceries', name: 'Groceries', planned: 300 }, { id: 'kids', name: 'Kids', planned: 640 }, { id: 'housing', name: 'Housing', planned: 2000 }],
    transactions: transactions.map((item, index) => ({ id: String(index), date: '2026-11-01', description: 'Shop', amount: 10, categoryId: 'groceries', sure: true, source: 'mail', ...item })),
  };
}

describe('the pace', () => {
  const daycare = { description: 'Bright Path Daycare', amount: 640, categoryId: 'kids', repeats: 'monthly' as const };

  it('gives each day an even share of everyday money', () => {
    expect(readPace(budgetWith([daycare]), '2026-11-10').room).toBe(100);
  });

  it('takes what was spent off the room', () => {
    expect(readPace(budgetWith([daycare, { amount: 40, date: '2026-11-02' }]), '2026-11-10').room).toBe(60);
  });

  it('is not thrown off by a repeating charge on the 1st', () => {
    expect(readPace(budgetWith([daycare]), '2026-11-02').room).toBeGreaterThan(0);
  });

  it('ignores rent', () => {
    expect(readPace(budgetWith([daycare, { amount: 2000, categoryId: 'housing' }]), '2026-11-10').room).toBe(100);
  });

  it('waits for a charge that still needs sorting', () => {
    expect(readPace(budgetWith([daycare, { amount: 889.5, sure: false, categoryId: 'other' }]), '2026-11-10').room).toBe(100);
  });

  it('counts a refund as money back', () => {
    expect(readPace(budgetWith([daycare, { amount: 50, date: '2026-11-02' }, { amount: -20, date: '2026-11-03' }]), '2026-11-10').room).toBe(70);
  });

  it('judges yesterday against a normal day', () => {
    const over = readPace(budgetWith([daycare, { amount: 25, date: '2026-11-09' }]), '2026-11-10');
    expect(over.yesterday).toBe(-15);
    expect(readPace(budgetWith([daycare]), '2026-11-10').yesterday).toBe(10);
  });

  it('keeps today out of what you kept', () => {
    const pace = readPace(budgetWith([daycare, { amount: 5, date: '2026-11-10' }]), '2026-11-10');
    expect(pace.kept).toBe(90);
    expect(pace.room).toBe(95);
  });
});

describe('what repeats', () => {
  const on = (date: string, description: string, amount: number, repeats?: 'weekly' | 'monthly' | 'yearly', renews?: string) => ({ date, description, amount, categoryId: 'bills', repeats, renews });

  it('trusts the next date a receipt states', () => {
    const [bill] = upcomingBills(budgetWith([on('2026-09-03', 'Google Health', 158.19, 'yearly', '2027-09-03')]), '2026-11-05');
    expect(bill).toMatchObject({ name: 'Google Health', date: '2027-09-03', every: 'yearly', stated: true });
  });

  it('works out the next date when the receipt does not say', () => {
    const bills = upcomingBills(budgetWith([on('2026-10-23', 'Cursor', 29.1, 'monthly'), on('2026-10-30', 'Gym', 10, 'weekly'), on('2026-03-01', 'Domain', 20, 'yearly')]), '2026-11-05');
    expect(bills.map((bill) => [bill.name, bill.date])).toEqual([['Gym', '2026-11-06'], ['Cursor', '2026-11-23'], ['Domain', '2027-03-01']]);
  });

  it('keeps two plans from the same company apart', () => {
    const bills = upcomingBills(budgetWith([on('2026-11-03', 'Apple (Google AI Plus)', 79.09, 'yearly'), on('2026-09-03', 'Apple (Fitbit Premium)', 158.19, 'yearly')]), '2026-11-05');
    expect(bills).toHaveLength(2);
  });

  it('still spots a bill from the same amount each month', () => {
    const [bill] = upcomingBills(budgetWith([on('2026-09-15', 'Toronto Hydro', 96), on('2026-10-15', 'Toronto Hydro', 96)]), '2026-11-05');
    expect(bill).toMatchObject({ date: '2026-11-15', every: 'monthly', stated: false });
  });

  it('leaves everyday shopping out unless a receipt says it renews', () => {
    const shopping = { categoryId: 'groceries', description: 'Costco', amount: 100 };
    expect(upcomingBills(budgetWith([{ ...shopping, date: '2026-09-15' }, { ...shopping, date: '2026-10-15' }]), '2026-11-05')).toEqual([]);
  });

  it('adds it all up as a monthly number', () => {
    const bills = upcomingBills(budgetWith([on('2026-10-23', 'Cursor', 30, 'monthly'), on('2026-09-03', 'Fitbit', 120, 'yearly')]), '2026-11-05');
    expect(monthlyRenewals(bills)).toBe(40);
  });

  it('warns about a renewal the receipt promised', () => {
    const insights = agentInsights(budgetWith([on('2026-10-08', 'Cursor', 29.1, 'monthly')]), '2026-11', '2026-11-05');
    expect(insights.find((insight) => insight.id.startsWith('renews-'))?.title).toBe('Cursor renews in 3 days');
  });

  it('does not call a habit a renewal', () => {
    const bus = [on('2026-09-08', 'Presto Reload', 80), on('2026-10-08', 'Presto Reload', 80)];
    expect(agentInsights(budgetWith(bus), '2026-11', '2026-11-05').some((insight) => insight.id.startsWith('renews-'))).toBe(false);
  });

  it('keeps what the agent read through to the budget', () => {
    const { budget } = importStatement([{ date: '2026-09-03', description: 'Fitbit', amount: 158.19, emailed: true, repeats: 'yearly', renews: '2027-09-03' }], null, 0);
    expect(budget.transactions[0]).toMatchObject({ repeats: 'yearly', renews: '2027-09-03' });
  });

  it('accepts only real answers from the agent', () => {
    const [clean, oneOff, nonsense] = cleanAgentRows([
      { date: '2026-09-03', description: 'Fitbit', amount: 158.19, repeats: 'yearly', renews: '2027-09-03' },
      { date: '2026-09-03', description: 'Costco', amount: 50, repeats: 'no' },
      { date: '2026-09-03', description: 'Odd', amount: 5, repeats: 'sometimes', renews: 'soon' },
    ], '2026-11-05');
    expect(clean).toMatchObject({ repeats: 'yearly', renews: '2027-09-03' });
    expect(oneOff.repeats).toBeUndefined();
    expect(nonsense.repeats).toBeUndefined();
    expect(nonsense.renews).toBeUndefined();
  });
});
