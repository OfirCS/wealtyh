import { describe, expect, it } from 'vitest';
import { agentInsights, upcomingDeadlines } from '@/lib/agent-insights';
import { combineScreens } from '@/lib/budget-agent';
import { autoBudget, emptyBudget, importStatement, mergeDeadlines, nextUnsure, setPlanned, typicalSpending } from '@/lib/budget';
import type { Budget, Transaction } from '@/lib/budget';
import { calendarFile, dailyFind, tomorrowLine } from '@/lib/comeback';
import { cleanDeadlines } from '@/lib/statement';

function budgetWith(transactions: Partial<Transaction>[], extra: Partial<Budget> = {}): Budget {
  return {
    ...emptyBudget(),
    categories: [{ id: 'groceries', name: 'Groceries', planned: 300 }],
    transactions: transactions.map((item, index) => ({ id: String(index), date: '2026-11-01', description: 'Shop', amount: 10, categoryId: 'groceries', sure: true, source: 'mail', ...item })),
    ...extra,
  };
}

const cursor = { description: 'Cursor', amount: 29.1, categoryId: 'bills', repeats: 'monthly' as const };

describe('the daily find', () => {
  const busy = budgetWith([
    { amount: -30.5 }, ...Array.from({ length: 6 }, (_, index) => ({ description: 'Subway', amount: 11, date: `2026-10-0${index + 1}` })), { ...cursor, date: '2026-10-23' },
  ]);

  it('says nothing when there is nothing to say', () => {
    expect(dailyFind(emptyBudget(), '2026-11-05')).toBeNull();
  });

  it('changes from day to day', () => {
    const finds = new Set(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((day) => dailyFind(busy, day)));
    expect(finds.size).toBeGreaterThan(1);
  });

  it('stays the same all day', () => {
    expect(dailyFind(busy, '2026-11-05')).toBe(dailyFind(busy, '2026-11-05'));
  });

  it('uses their real numbers', () => {
    const days = Array.from({ length: 12 }, (_, index) => dailyFind(busy, `2026-11-${String(index + 1).padStart(2, '0')}`));
    expect(days.join(' ')).toContain('$31 back in refunds');
  });
});

describe('the reason to return', () => {
  it('names a renewal due tomorrow first', () => {
    const budget = budgetWith([{ ...cursor, date: '2026-10-06' }]);
    expect(tomorrowLine(budget, '2026-11-05')).toBe('Tomorrow: Cursor renews for $29.');
  });

  it('points at a shield that is one day away', () => {
    const checkIns = Array.from({ length: 6 }, (_, index) => `2026-11-0${index + 1}`);
    expect(tomorrowLine(budgetWith([], { checkIns }), '2026-11-06')).toBe('Tomorrow: day 7 earns you a shield.');
  });

  it('still gives a reason on a quiet day', () => {
    expect(tomorrowLine(budgetWith([], { checkIns: ['2026-11-05'] }), '2026-11-05')).toBe('Tomorrow: day 2, and a new find.');
  });
});

describe('calendar reminders', () => {
  const file = calendarFile(budgetWith([{ ...cursor, date: '2026-10-23' }]), '2026-11-05', 'https://example.com');

  it('makes a real calendar file', () => {
    expect(file.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(file.trim().endsWith('END:VCALENDAR')).toBe(true);
    expect(file).toContain('\r\n');
  });

  it('repeats a check-in every evening, starting tomorrow', () => {
    expect(file).toContain('RRULE:FREQ=DAILY');
    expect(file).toContain('DTSTART:20261106T193000');
  });

  it('warns the day before a renewal', () => {
    expect(file).toContain('SUMMARY:Cursor renews tomorrow: $29');
    expect(file).toContain('DTSTART:20261122T090000');
  });
});

describe('the best budget', () => {
  const spent = (categoryId: string, amount: number, date: string, extra: Partial<Transaction> = {}) => ({ categoryId, amount, date, description: categoryId, ...extra });

  it('sets each amount from what really gets spent', () => {
    const budget = autoBudget(budgetWith([spent('groceries', 600, '2026-09-10'), spent('groceries', 600, '2026-10-10')]));
    expect(budget.categories.find((category) => category.id === 'groceries')?.planned).toBe(600);
  });

  it('drops a category nothing is left in', () => {
    const budget = autoBudget(budgetWith([spent('groceries', 100, '2026-10-10')], { categories: [{ id: 'other', name: 'Other', planned: 980 }] }));
    expect(budget.categories.map((category) => category.id)).toEqual(['groceries']);
  });

  it('adds a category first seen this month', () => {
    const budget = autoBudget(budgetWith([spent('groceries', 100, '2026-10-10'), spent('kids', 40, '2026-11-02')]));
    expect(budget.categories.find((category) => category.id === 'kids')?.planned).toBe(40);
  });

  it('never counts money that is not spending', () => {
    const budget = autoBudget(budgetWith([spent('transfer', 900, '2026-10-10'), spent('income', -3000, '2026-10-11')]));
    expect(budget.categories).toEqual([]);
  });

  it('leaves a budget alone once the user has set their own', () => {
    const mine = setPlanned(budgetWith([spent('groceries', 100, '2026-10-10')]), 'groceries', 777);
    expect(autoBudget(mine)).toBe(mine);
  });

  it('spreads a yearly charge across twelve months', () => {
    const budget = budgetWith([spent('bills', 120, '2026-09-10', { repeats: 'yearly' }), spent('groceries', 100, '2026-09-10'), spent('groceries', 100, '2026-10-10')]);
    expect(typicalSpending(budget).bills).toBe(10);
  });
});

describe('asking only what matters', () => {
  it('asks about the biggest money first', () => {
    const budget = budgetWith([
      { description: 'Tiny Shop', amount: 5, sure: false, date: '2026-10-01' },
      { description: 'Big Person', amount: 900, sure: false, date: '2026-10-02' },
    ]);
    expect(nextUnsure(budget)?.transaction.description).toBe('Big Person');
  });
});

describe('never counting a purchase twice', () => {
  const row = { date: '2026-10-16', description: 'Amazon.ca', amount: 45.19, emailed: true };

  it('recognises an email read again under a slightly different name', () => {
    const first = importStatement([row], null, 0, 'mail').budget;
    const { budget, summary } = importStatement([{ ...row, description: 'Amazon' }], first, 0, 'mail');
    expect(budget.transactions).toHaveLength(1);
    expect(summary.repeats).toBe(1);
  });

  it('keeps two real purchases of the same amount on the same day', () => {
    const { budget } = importStatement([row, { ...row, description: 'Other Shop' }], null, 0, 'mail');
    expect(budget.transactions).toHaveLength(2);
  });

  it('counts a refund against the purchase, not as pay', () => {
    const { budget } = importStatement([row, { ...row, date: '2026-10-20', amount: -45.19, category: 'shopping' }], null, 0, 'mail');
    expect(budget.income).toBe(0);
    expect(budget.transactions.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(0);
  });
});

describe('a statement line the agent has sorted', () => {
  it('trusts the agent over a guess', () => {
    const { budget } = importStatement([{ date: '2026-10-16', description: 'QOMFORT CO', amount: 92.7, category: 'shopping' }], null, 0);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'shopping', sure: true });
  });

  it('files a card payment as not spending', () => {
    const { budget } = importStatement([{ date: '2026-10-16', description: 'WS TRANSFER', amount: 900, category: 'transfer' }], null, 0);
    expect(budget.transactions[0].categoryId).toBe('transfer');
  });

  it('still asks when the agent cannot tell', () => {
    const { budget } = importStatement([{ date: '2026-10-16', description: 'J SMITH', amount: 60, category: 'other' }], null, 0);
    expect(budget.transactions[0]).toMatchObject({ categoryId: 'other', sure: false });
  });
});

describe('the deadline radar', () => {
  const socks = { kind: 'return' as const, what: 'Socks', date: '2026-11-07', amount: 30.5 };

  it('keeps only real, future deadlines from the agent', () => {
    const clean = cleanDeadlines([socks, { ...socks, date: '2026-10-01' }, { ...socks, kind: 'nonsense' }, { kind: 'trial', what: '  ', date: '2026-11-07' }, { kind: 'trial', what: 'Canva', date: 'soon' }], '2026-11-05');
    expect(clean).toEqual([socks]);
  });

  it('keeps one of each when two emails mention it', () => {
    const budget = mergeDeadlines(mergeDeadlines(budgetWith([]), [socks]), [{ ...socks, what: 'SOCKS' }]);
    expect(budget.deadlines).toHaveLength(1);
  });

  it('warns when a deadline is close', () => {
    const insight = agentInsights(budgetWith([{}], { deadlines: [socks] }), '2026-11', '2026-11-05').find((item) => item.id.startsWith('deadline-'));
    expect(insight).toMatchObject({ title: 'Return Socks by Nov 7', detail: '$31' });
  });

  it('stays quiet about a refund, which needs no action', () => {
    const insights = agentInsights(budgetWith([{}], { deadlines: [{ ...socks, kind: 'refund' }] }), '2026-11', '2026-11-05');
    expect(insights.some((item) => item.id.startsWith('deadline-'))).toBe(false);
  });

  it('ignores one that has passed', () => {
    expect(upcomingDeadlines(budgetWith([], { deadlines: [socks] }), '2026-11-08')).toEqual([]);
  });

  it('comes first in tomorrow', () => {
    const budget = budgetWith([{ ...cursor, date: '2026-10-07' }], { deadlines: [socks] });
    expect(tomorrowLine(budget, '2026-11-06')).toBe('Tomorrow: Return Socks.');
  });

  it('goes in the calendar', () => {
    expect(calendarFile(budgetWith([], { deadlines: [socks] }), '2026-11-05', 'https://example.com')).toContain('SUMMARY:Return Socks by tomorrow');
  });
});

describe('reading screenshots', () => {
  const coffee = { date: '2026-11-01', description: 'Tim Hortons', amount: 9.84 };
  const gas = { date: '2026-11-02', description: 'Esso', amount: 60 };

  it('counts a purchase on two overlapping screens once', () => {
    expect(combineScreens([[coffee, gas], [gas]])).toHaveLength(2);
  });

  it('keeps two identical purchases shown on one screen', () => {
    expect(combineScreens([[coffee, coffee], [coffee]])).toHaveLength(2);
  });

  it('keeps different purchases', () => {
    expect(combineScreens([[coffee], [gas]])).toHaveLength(2);
  });
});
