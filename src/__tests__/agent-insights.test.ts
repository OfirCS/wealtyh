import { describe, expect, it } from 'vitest';
import { agentInsights, tidyName, upcomingBills } from '@/lib/agent-insights';
import { emptyBudget, importStatement, sortMerchant } from '@/lib/budget';
import { sampleStatement } from '@/lib/sample-statement';
import { parseStatement } from '@/lib/statement';

const TODAY = new Date(2026, 10, 15);
const { budget } = importStatement(parseStatement(sampleStatement(TODAY)), null, 0);

describe('tidyName', () => {
  it.each([
    ['SQ *MAPLE CORNER BAKERY #12', 'Maple Corner Bakery'],
    ['TIM HORTONS #4410', 'Tim Hortons'],
    ['Apple (Google AI Pro)', 'Apple (Google AI Pro)'],
    ['Apple (Meta Verified For Business, 200 GB)', 'Apple (Meta Verified)'],
    ['Apple (iCloud+ 200 GB)', 'Apple (iCloud+)'],
    ['Instacart (costco)', 'Instacart (Costco)'],
    ['Natalie Berkovitz (e-transfer)', 'Natalie Berkovitz (e-transfer)'],
    ['netflix.com', 'Netflix.com'],
  ])('reads %s as %s', (description, name) => {
    expect(tidyName(description)).toBe(name);
  });
});

describe('upcomingBills', () => {
  const bills = upcomingBills(budget, '2026-11-15');

  it('finds charges that repeat for the same amount', () => {
    expect(bills.map((bill) => bill.name)).toEqual(expect.arrayContaining(['Goodlife Fitness', 'Toronto Hydro']));
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

  it('gives each thing to do once', () => {
    const ids = agentInsights(budget, '2026-10').map((insight) => insight.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts a possible double charge first, ahead of charges to sort', () => {
    const ids = agentInsights(budget, '2026-10').map((insight) => insight.id);
    expect(ids[0]).toMatch(/^duplicate-/);
    expect(ids).toContain('sort');
  });

  it('stops asking once everything is sorted', () => {
    let sorted = budget;
    for (const transaction of budget.transactions.filter((item) => !item.sure)) {
      sorted = sortMerchant(sorted, transaction.description, 'fun');
    }
    expect(agentInsights(sorted, '2026-10').some((insight) => insight.id === 'sort')).toBe(false);
  });

  it('offers to raise a budget set below what things usually cost', () => {
    const raise = agentInsights({ ...budget, categories: budget.categories.map((category) => ({ ...category, planned: 1 })) }, '2026-10').find((insight) => insight.id.startsWith('raise-'));
    expect(raise?.title).toMatch(/: usually \$[\d,]+/);
    expect(raise?.change?.amount).toBeGreaterThan(1);
  });

  it('does not warn about overspending when it has never seen any pay', () => {
    expect(agentInsights({ ...budget, income: 0 }, '2026-10').some((insight) => insight.id === 'short')).toBe(false);
  });

  it('offers a plan for money with no job', () => {
    expect(agentInsights({ ...budget, income: 99_999 }, '2026-10').find((insight) => insight.id === 'free')?.prompt).toContain('left over');
  });
});

describe('consistent numbers', () => {
  it('averages over finished months, leaving out the one still underway', () => {
    const payIn = budget.transactions.filter((item) => item.categoryId === 'income' && item.date < '2026-11').reduce((sum, item) => sum - item.amount, 0);
    expect(budget.income).toBe(Math.round(payIn / 2));
  });
});
