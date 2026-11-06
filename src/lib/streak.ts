// The reason to come back. Most budget apps lose people the day they overspend,
// because that's the day they stop looking. So this streak can't be broken by a
// bad day of spending, only by looking away. Each check-in also says how the day
// went, and what you kept adds up, so the streak turns into real money.

import { CHARGES_A_MONTH, chargeKey, repeatingCharges } from './agent-insights';
import { countsAsSpending, daysInMonth, purchaseRhythms } from './budget';
import type { Budget } from './budget';

const DAY_MS = 86_400_000;
const DAYS_PER_SHIELD = 7;
const MAX_SHIELDS = 2;
const CHECK_INS_KEPT = 400;

/** Bills arrive whatever you do, so only everyday spending counts toward your pace. */
const FIXED_CATEGORIES = new Set(['housing', 'bills', 'debt']);

export interface Streak {
  days: number;
  best: number;
  /** Spare days that cover one you miss. Earned by showing up. */
  shields: number;
  checkedInToday: boolean;
}

/** Today where the user is, since a streak runs on their clock and not UTC. */
export function localDay(date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Replays every check-in, so a streak is always worked out and can never drift. */
export function readStreak(checkIns: string[] | undefined, today: string): Streak {
  const checked = new Set(checkIns);
  const first = [...checked].sort()[0];
  let days = 0;
  let best = 0;
  let shields = 0;

  if (first) {
    for (let day = first; day <= today; day = addDays(day, 1)) {
      if (checked.has(day)) {
        days += 1;
        best = Math.max(best, days);
        if (days % DAYS_PER_SHIELD === 0) shields = Math.min(MAX_SHIELDS, shields + 1);
      } else if (day === today) {
        break;
      } else if (shields > 0) {
        shields -= 1;
      } else {
        days = 0;
      }
    }
  }

  return { days, best, shields, checkedInToday: checked.has(today) };
}

export function recordCheckIn(budget: Budget, today: string): Budget {
  const checkIns = budget.checkIns ?? [];
  if (checkIns.includes(today)) return budget;
  return { ...budget, checkIns: [...checkIns, today].slice(-CHECK_INS_KEPT) };
}

export interface Pace {
  /** What can still be spent today while staying on pace. Negative means over. */
  room: number;
  /** How far ahead of pace the month was as of yesterday. Negative means behind. */
  kept: number;
  /** Yesterday compared with a normal day. Positive means it came in under. */
  yesterday: number;
}

/** Compares everyday spending with an even pace through the month. */
export function readPace(budget: Budget, today: string): Pace {
  const month = today.slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));
  const yesterdayDate = addDays(today, -1);

  // Daycare lands on the 1st whatever you do, so a repeating charge can't put you off pace
  const repeating = repeatingCharges(budget, today);
  const rhythms = purchaseRhythms(budget);
  const everydayBudget = budget.categories
    .filter((category) => !FIXED_CATEGORIES.has(category.id))
    .reduce((sum, category) => sum + category.planned, 0);
  const everydayBills = [...repeating.values()]
    .filter((charge) => !FIXED_CATEGORIES.has(charge.categoryId))
    .reduce((sum, charge) => sum + charge.amount * CHARGES_A_MONTH[charge.repeats ?? 'monthly'], 0);
  const perDay = Math.max(0, everydayBudget - everydayBills) / daysInMonth(month);

  let spentThisMonth = 0;
  let spentToday = 0;
  let spentYesterday = 0;
  for (const transaction of budget.transactions) {
    // Charges still waiting to be sorted might be rent, so they wait too
    if (!countsAsSpending(transaction) || !transaction.sure || rhythms.get(transaction.id) === 'once' || FIXED_CATEGORIES.has(transaction.categoryId) || repeating.has(chargeKey(transaction))) continue;
    if (transaction.date.startsWith(month)) spentThisMonth += transaction.amount;
    if (transaction.date === today) spentToday += transaction.amount;
    if (transaction.date === yesterdayDate) spentYesterday += transaction.amount;
  }

  return {
    room: Math.round(perDay * dayOfMonth - spentThisMonth),
    kept: Math.round(perDay * (dayOfMonth - 1) - (spentThisMonth - spentToday)),
    yesterday: Math.round(perDay - spentYesterday),
  };
}
