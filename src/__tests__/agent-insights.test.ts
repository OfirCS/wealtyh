import { describe, expect, it } from 'vitest';
import { agentInsights, upcomingBills } from '@/lib/agent-insights';
import { emptyBudget, importStatement, sortMerchant } from '@/lib/budget';
import { sampleStatement } from '@/lib/sample-statement';
import { parseStatement } from '@/lib/statement';

const TODAY = new Date(2026, 10, 15);
const { budget } = importStatement(parseStatement(sampleStatement(TODAY)), null, 0);

describe('upcomingBills', () => {
  const bills = upcomingBills(budget, '2026-11-15');

  it('finds charges that repeat for the same amount', () => {
    expect(bills.map((bill) => bill.name)).toEqual(expect.arrayContaining(['Rogers Wireless', 'Netflix.com']));
  });

  it('never lists a date in the past, and sorts soonest first', () => {
    expect(bills.every((bill) => bill.date >= '2026-11-15')).toBe(true);
    expect([...bills].sort((a, b) => a.date.localeCompare(b.date))).toEqual(bills);
  });

  it('skips one-off purchases and money that is not spending', () => {
    expect(bills.some((bill) => /Ticketmaster|Payroll|E-transfer/i.test(bill.name))).toBe(false);
  });

  it('copes with an empty budget', () => {
    expect(upcomingBills(emptyBudget(), '2026-11-15')).toEqual([]);
  });
});

describe('agentInsights', () => {
  it('asks to connect when it has nothing to read', () => {
    expect(agentInsights(null, '2026-10')[0].action).toBe('connect');
    expect(agentInsights(emptyBudget(), '2026-10')[0].action).toBe('connect');
  });

  it('never gives more than three things to do', () => {
    expect(agentInsights(budget, '2026-10').length).toBeLessThanOrEqual(3);
  });

  it('puts charges it could not sort first', () => {
    expect(agentInsights(budget, '2026-10')[0].id).toBe('sort');
  });

  it('stops asking once everything is sorted', () => {
    let sorted = budget;
    for (const transaction of budget.transactions.filter((item) => !item.sure)) {
      sorted = sortMerchant(sorted, transaction.description, 'fun');
    }
    expect(agentInsights(sorted, '2026-10').some((insight) => insight.id === 'sort')).toBe(false);
  });

  it('names a real overspent category', () => {
    const over = agentInsights({ ...budget, categories: budget.categories.map((category) => ({ ...category, planned: 1 })) }, '2026-10').find((insight) => insight.id === 'over');
    expect(over?.title).toMatch(/\$[\d,]+ over/);
  });

  it('offers a plan for money with no job', () => {
    expect(agentInsights({ ...budget, income: 99_999 }, '2026-10').find((insight) => insight.id === 'free')?.prompt).toContain('left over');
  });
});

describe('consistent numbers', () => {
  it('divides a two-month statement by exactly two', () => {
    const payIn = budget.transactions.filter((item) => item.categoryId === 'income').reduce((sum, item) => sum - item.amount, 0);
    expect(budget.income).toBe(Math.round(payIn / 2));
  });
});
