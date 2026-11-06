import { describe, expect, it } from 'vitest';
import { checkIn, pointsToday, punchesOnCard, readGoal, readPoints, weekGoal } from '@/lib/points';
import type { Budget, Transaction } from '@/lib/budget';

// 2026-11-09 is a Monday
const MONDAY = '2026-11-09';

function buy(id: string, date: string, description: string, amount: number, categoryId: string): Transaction {
  return { id, date, description, amount, categoryId, sure: true };
}

function budgetOf(transactions: Transaction[] = [], extra: Partial<Budget> = {}): Budget {
  return { income: 0, categories: [], merchantRules: {}, transactions, ...extra };
}

const takeout = [
  buy('a', '2026-10-13', 'Pizza Nova', 40, 'eating'),
  buy('b', '2026-10-20', 'Pizza Nova', 60, 'eating'),
  buy('c', '2026-10-27', 'Pizza Nova', 50, 'eating'),
  buy('d', '2026-11-03', 'Pizza Nova', 50, 'eating'),
];

describe('points', () => {
  it('starts at the first level', () => {
    expect(readPoints(null)).toMatchObject({ total: 0, level: 1, name: 'Starter', next: { name: 'Steady', toGo: 500 } });
  });

  it('earns for checking in, once a day', () => {
    const once = checkIn(budgetOf(), MONDAY);
    expect(readPoints(once).total).toBe(10);
    expect(readPoints(checkIn(once, MONDAY)).total).toBe(10);
    expect(pointsToday(once, MONDAY)).toBe(10);
  });

  it('earns once for each connected source', () => {
    const budget = budgetOf([{ ...buy('a', MONDAY, 'Shop', 5, 'other'), source: 'mail' }]);
    const first = checkIn(budget, MONDAY);
    const second = checkIn(first, '2026-11-10');
    expect(first.points?.filter((entry) => entry.id === 'connected:gmail')).toHaveLength(1);
    expect(second.points?.filter((entry) => entry.id === 'connected:gmail')).toHaveLength(1);
  });

  it('rewards a seven-day streak', () => {
    const checkIns = Array.from({ length: 6 }, (_, index) => `2026-11-0${index + 3}`);
    const next = checkIn(budgetOf([], { checkIns }), MONDAY);
    expect(next.points?.map((entry) => entry.label)).toContain('7-day streak');
  });

  it('never takes points away', () => {
    const before = readPoints(checkIn(budgetOf(), MONDAY)).total;
    const after = checkIn(budgetOf(takeout.map((item) => ({ ...item, amount: 900 })), { points: checkIn(budgetOf(), MONDAY).points }), '2026-11-10');
    expect(readPoints(after).total).toBeGreaterThanOrEqual(before);
  });

  it('keeps the total when old entries are dropped', () => {
    const points = Array.from({ length: 300 }, (_, index) => ({ id: `old:${index}`, date: '2026-01-01', label: 'Old', points: 10 }));
    const next = checkIn(budgetOf([], { points }), MONDAY);
    expect(next.points).toHaveLength(300);
    expect(readPoints(next).total).toBe(3010);
    expect(readPoints(next).name).toBe('Sharp');
  });
});

describe('the punch card', () => {
  it.each([
    [0, false, 0],
    [1, true, 1],
    [4, false, 4],
    [4, true, 4],
    [6, false, 6],
    [7, true, 7],
    [7, false, 0],
    [8, true, 1],
    [14, true, 7],
  ])('%i days, checked in %s: %i punched', (days, checkedInToday, punched) => {
    expect(punchesOnCard({ days, checkedInToday })).toBe(punched);
  });
});

describe('the week goal', () => {
  it('is a little tighter than usual, in something they can choose', () => {
    expect(weekGoal(budgetOf(takeout), MONDAY)).toMatchObject({ categoryId: 'eating', title: 'Eating out under $40', target: 40 });
  });

  it("doesn't move once the week has started", () => {
    const later = budgetOf([...takeout, buy('e', '2026-11-10', 'Pizza Nova', 400, 'eating')]);
    expect(weekGoal(later, MONDAY)).toEqual(weekGoal(budgetOf(takeout), MONDAY));
  });

  it('counts what has been spent this week', () => {
    const goal = readGoal(budgetOf([...takeout, buy('e', '2026-11-10', 'Pizza Nova', 25, 'eating')]), '2026-11-11');
    expect(goal).toMatchObject({ done: 25, over: false, detail: '$25 of $40 · 5 days left' });
  });

  it('says when a goal has gone over, and when the next one starts', () => {
    const budget = budgetOf([...takeout, buy('e', '2026-11-10', 'Pizza Nova', 55, 'eating')]);
    expect(readGoal(budget, '2026-11-15')).toMatchObject({ over: true, share: 1, detail: '$55 of $40 · Last day', next: 'New goal tomorrow' });
    expect(readGoal(budget, '2026-11-12')).toMatchObject({ over: true, next: 'New goal Monday' });
  });

  it("isn't set by a one big order", () => {
    const orders = [buy('s1', '2026-10-14', 'Big Order', 900, 'shopping'), buy('s2', '2026-10-28', 'Big Order', 700, 'shopping')];
    expect(weekGoal(budgetOf([...takeout, ...orders]), MONDAY)).toMatchObject({ categoryId: 'eating' });
  });

  it("isn't raised by one unusual week", () => {
    const party = takeout.map((item) => (item.id === 'b' ? { ...item, amount: 600 } : item));
    expect(weekGoal(budgetOf(party), MONDAY)).toMatchObject({ target: 40 });
  });

  it('prefers what they do most weeks', () => {
    const lunches = ['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'].map((date, index) => buy(`l${index}`, date, 'Subway', 20, 'eating'));
    const gas = ['2026-10-14', '2026-10-21', '2026-10-28'].map((date, index) => buy(`g${index}`, date, 'Shell', 80, 'transport'));
    const budget = budgetOf([...lunches, ...gas]);
    const week = '2026-11-09';
    const weekNumber = Math.floor(Date.parse(`${week}T00:00:00Z`) / (7 * 86_400_000));
    expect(weekGoal(budget, week).categoryId).toBe(['eating', 'transport'][weekNumber % 2]);
  });

  it('falls back to showing up when there is no history', () => {
    expect(readGoal(budgetOf([], { checkIns: [MONDAY] }), MONDAY)).toMatchObject({ categoryId: null, title: 'Check in 5 days', detail: '1 of 5 · 7 days left' });
  });

  it('pays out the next week, once', () => {
    const played = budgetOf(takeout.map((item) => (item.id === 'd' ? { ...item, amount: 30 } : item)), { checkIns: ['2026-11-02'] });
    const next = checkIn(played, MONDAY);
    const won = next.points?.filter((entry) => entry.label.startsWith('Beat the goal'));
    expect(won).toHaveLength(1);
    expect(checkIn(next, '2026-11-10').points?.filter((entry) => entry.label.startsWith('Beat the goal'))).toHaveLength(1);
  });

  it("doesn't pay out a week they weren't playing", () => {
    expect(checkIn(budgetOf(takeout), MONDAY).points?.some((entry) => entry.label.startsWith('Beat the goal'))).toBe(false);
  });
});
