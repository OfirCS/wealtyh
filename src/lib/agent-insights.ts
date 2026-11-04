import { merchantKey, monthSummary, nextUnsure, totalPlanned } from './budget';
import type { Budget } from './budget';
import { formatMoney } from './money';

export interface Bill {
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}

function nextMonthly(lastDate: string, today: string): string {
  const [year, month, day] = lastDate.split('-').map(Number);
  let offset = 1;
  for (;;) {
    const candidate = new Date(Date.UTC(year, month - 1 + offset, day)).toISOString().slice(0, 10);
    if (candidate >= today) return candidate;
    offset += 1;
  }
}

/** Turns "SQ *MAPLE CORNER BAKERY #12" into "Maple Corner Bakery". */
export function tidyName(description: string): string {
  const words = description
    .replace(/^(sq|pp|tst|py|sp)\s*\*\s*/i, '')
    .replace(/[#*\d].*$/, '')
    .replace(/\s+-\s+.*$/, '')
    .trim()
    .toLowerCase()
    .split(/\s+/);
  const name = words.slice(0, 3).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return name || description;
}

// Everyday shopping can repeat by chance, but it isn't a bill
const NOT_BILLS = new Set(['groceries', 'eating', 'shopping', 'fun', 'transfer', 'income']);

/** Charges that repeat each month for about the same amount, with when they're next due. */
export function upcomingBills(budget: Budget, today: string): Bill[] {
  const byMerchant = new Map<string, { description: string; amount: number; date: string; months: Map<string, number> }>();
  for (const transaction of budget.transactions) {
    if (transaction.amount <= 0 || NOT_BILLS.has(transaction.categoryId)) continue;
    const key = merchantKey(transaction.description);
    const entry = byMerchant.get(key) ?? { ...transaction, months: new Map<string, number>() };
    entry.months.set(transaction.date.slice(0, 7), transaction.amount);
    if (transaction.date >= entry.date) {
      entry.date = transaction.date;
      entry.amount = transaction.amount;
      entry.description = transaction.description;
    }
    byMerchant.set(key, entry);
  }

  return [...byMerchant.values()]
    .filter(({ months }) => {
      const amounts = [...months.values()];
      return amounts.length >= 2 && Math.max(...amounts) <= Math.min(...amounts) * 1.15;
    })
    .map(({ description, amount, date }) => ({ name: tidyName(description), amount, date: nextMonthly(date, today) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  action: 'sort' | 'budget' | 'plan' | 'connect';
  label: string;
  /** What to ask the planner, for a plan action. */
  prompt?: string;
}

/** What the agent would bring up today, most useful first. Everything comes from real numbers. */
export function agentInsights(budget: Budget | null, month: string): Insight[] {
  if (!budget || budget.transactions.length === 0) {
    return [{ id: 'connect', title: 'I need something to read', detail: 'Connect Gmail and I’ll get to work.', action: 'connect', label: 'Connect' }];
  }

  const insights: Insight[] = [];
  const unsure = nextUnsure(budget);
  if (unsure) {
    insights.push({
      id: 'sort',
      title: `${unsure.remaining} ${unsure.remaining === 1 ? 'charge needs' : 'charges need'} your eye`,
      detail: `Like ${tidyName(unsure.transaction.description)}. One tap each and I’ll remember.`,
      action: 'sort',
      label: 'Sort them',
    });
  }

  const summary = monthSummary(budget, month);
  const over = budget.categories
    .map((category) => ({ name: category.name, amount: (summary.spentByCategory[category.id] ?? 0) - category.planned }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0];
  if (over) {
    insights.push({
      id: 'over',
      title: `${over.name} is ${formatMoney(over.amount)} over`,
      detail: 'Want to see what pushed it past your budget?',
      action: 'budget',
      label: 'Take a look',
    });
  }

  const free = budget.income - totalPlanned(budget);
  if (free > 100) {
    insights.push({
      id: 'free',
      title: `${formatMoney(free)} a month has no job yet`,
      detail: 'I can plan where it should go.',
      action: 'plan',
      label: 'Make a plan',
      prompt: `I have ${formatMoney(free)} a month left over. Where should it go?`,
    });
  } else if (free < -100) {
    insights.push({
      id: 'short',
      title: `You budget ${formatMoney(-free)} more than comes in`,
      detail: 'Let’s find where to trim.',
      action: 'plan',
      label: 'Fix it',
      prompt: `I'm spending ${formatMoney(-free)} a month more than I bring in. Help me fix it.`,
    });
  }

  return insights.slice(0, 3);
}
