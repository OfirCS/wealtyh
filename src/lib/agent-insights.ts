import { chargeKey, monthSummary, nextUnsure, NOT_BILLS, repeatingCharges, SOURCE_LABELS, totalPlanned, typicalSpending } from './budget';
import type { Budget, Transaction } from './budget';
import { formatMoney } from './money';
import type { Deadline, Repeats } from './statement';

export interface Bill {
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  every: Repeats;
  /** True when a receipt said so. False when it's only a pattern in the dates. */
  stated: boolean;
}

/** The next charge on or after today, counting forward from the last one. */
export function nextCharge(lastDate: string, every: Repeats, today: string): string {
  const [year, month, day] = lastDate.split('-').map(Number);
  for (let step = 1; ; step += 1) {
    const candidate = new Date(Date.UTC(
      year + (every === 'yearly' ? step : 0),
      month - 1 + (every === 'monthly' ? step : 0),
      day + (every === 'weekly' ? step * 7 : 0),
    )).toISOString().slice(0, 10);
    if (candidate >= today) return candidate;
  }
}

const LITTLE_WORDS = new Set(['a', 'an', 'and', 'by', 'for', 'of', 'the', 'to', 'with']);
const NAME_WORDS = 3;

/** Bank lines shout and receipts don't, so only shouted words change. "iCloud" and "AI" stay as written. */
function softened(word: string, shouting: boolean): string {
  if (/^e-?transfer$/i.test(word)) return word.toLowerCase();
  if (!shouting) return word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function firstWords(text: string): string {
  const shouting = text === text.toUpperCase();
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, NAME_WORDS);
  while (words.length > 1 && LITTLE_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.map((word) => softened(word, shouting)).join(' ');
}

/** Turns "SQ *MAPLE CORNER BAKERY #12" into "Maple Corner Bakery", and keeps a detail in brackets whole. */
export function tidyName(description: string): string {
  const [, main = description, detail = ''] = description.match(/^([^(]*)\(([^)]*)\)?/) ?? [];
  const name = firstWords(main
    .replace(/^(sq|pp|tst|py|sp)\s*\*\s*/i, '')
    .replace(/\s*\S*[#*\d].*$/, '')
    .replace(/\s+-\s+.*$/, ''));
  if (!name) return description;
  const extra = firstWords(detail.split(',')[0].replace(/\s\d.*$/, ''));
  return extra ? `${name} (${extra})` : name;
}

export const CHARGES_A_MONTH: Record<Repeats, number> = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };

/** What everything that renews by itself costs, as one monthly number. */
export function monthlyRenewals(bills: Bill[]): number {
  return bills.reduce((sum, bill) => sum + bill.amount * CHARGES_A_MONTH[bill.every], 0);
}

export { chargeKey, repeatingCharges };

/** Everything that will charge again, with when it's next due. */
export function upcomingBills(budget: Budget, today: string): Bill[] {
  return [...repeatingCharges(budget, today).values()]
    .map((latest) => {
      const every = latest.repeats ?? 'monthly';
      const stated = latest.renews && latest.renews >= today ? latest.renews : null;
      return {
        name: latest.repeats ? latest.description : tidyName(latest.description),
        amount: latest.amount,
        date: stated ?? nextCharge(latest.date, every, today),
        every,
        stated: !!latest.repeats,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  action: 'sort' | 'plan' | 'connect' | 'approve' | 'open' | 'income' | 'wallet' | 'bank' | 'category' | 'bills';
  label: string;
  /** What to ask the planner, for a plan action. */
  prompt?: string;
  /** The budget change the agent is proposing, for an approve action. */
  change?: { categoryId: string; amount: number };
  /** The purchase to show, for an open action. */
  transactionId?: string;
  /** The category to show, for a category action. */
  categoryId?: string;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function chargesByMerchant(budget: Budget): Map<string, Transaction[]> {
  const merchants = new Map<string, Transaction[]>();
  for (const transaction of budget.transactions) {
    if (transaction.amount <= 0 || transaction.categoryId === 'transfer' || transaction.categoryId === 'income') continue;
    const key = chargeKey(transaction);
    merchants.set(key, [...(merchants.get(key) ?? []), transaction]);
  }
  return merchants;
}

// Small enough to ignore rounding, big enough to matter on a bill
const PRICE_RISE = 1.04;
const PRICE_WINDOW = 3;

/** A regular bill that costs more than it did a couple of months ago. */
export function findPriceRise(budget: Budget): { name: string; before: number; after: number; latest: Transaction } | null {
  for (const charges of chargesByMerchant(budget).values()) {
    // A tank of gas costs what it costs. Only a fixed price can rise
    if (NOT_BILLS.has(charges[0].categoryId) || charges[0].categoryId === 'transport') continue;
    const months = new Map(charges.map((charge) => [charge.date.slice(0, 7), charge.amount]));
    const recent = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-PRICE_WINDOW).map(([, amount]) => amount);
    if (recent.length < 2) continue;
    const before = recent[0];
    const after = recent[recent.length - 1];
    if (after >= before * PRICE_RISE && after <= before * 1.4) {
      const latest = charges.reduce((newest, charge) => (charge.date > newest.date ? charge : newest));
      return { name: tidyName(charges[0].description), before, after, latest };
    }
  }
  return null;
}

const DUPLICATE_DAYS = 2;

/** The same amount from the same place, a day or two apart. */
export function findDuplicate(budget: Budget): { name: string; first: Transaction; second: Transaction } | null {
  for (const charges of chargesByMerchant(budget).values()) {
    const sorted = [...charges].sort((a, b) => a.date.localeCompare(b.date));
    for (let index = 1; index < sorted.length; index += 1) {
      const [first, second] = [sorted[index - 1], sorted[index]];
      const days = (Date.parse(second.date) - Date.parse(first.date)) / 86_400_000;
      if (first.amount === second.amount && days <= DUPLICATE_DAYS && first.amount >= 5) {
        return { name: tidyName(second.description), first, second };
      }
    }
  }
  return null;
}

/** What the agent would bring up today, most useful first. Everything comes from real numbers. */
const RENEWAL_WARNING_DAYS = 7;

/** What's still to come, soonest first. */
export function upcomingDeadlines(budget: Budget, today: string): Deadline[] {
  return (budget.deadlines ?? []).filter((deadline) => deadline.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

export function deadlineTitle({ kind, what }: Deadline): string {
  if (kind === 'return') return `Return ${what}`;
  if (kind === 'trial') return `${what} trial ends`;
  return `${what} refund due`;
}

export function agentInsights(budget: Budget | null, month: string, today = new Date().toLocaleDateString('en-CA')): Insight[] {
  if (!budget || budget.transactions.length === 0) {
    return [{ id: 'connect', title: 'Bring in your receipts', detail: '', action: 'connect', label: 'Start' }];
  }

  const insights: Insight[] = [];
  const duplicate = findDuplicate(budget);
  if (duplicate) {
    insights.push({
      id: `duplicate-${duplicate.second.id}`,
      title: `${duplicate.name} charged twice?`,
      detail: `${formatMoney(duplicate.first.amount)}, ${shortDate(duplicate.first.date)} and ${shortDate(duplicate.second.date).replace(/^\D+/, '')}`,
      action: 'open',
      label: 'Review',
      transactionId: duplicate.second.id,
    });
  }

  const rise = findPriceRise(budget);
  if (rise) {
    insights.push({
      id: `rise-${rise.name}`,
      title: `${rise.name} went up ${formatMoney(rise.after - rise.before)}`,
      detail: `${formatMoney(rise.before)} to ${formatMoney(rise.after)} a month`,
      action: 'open',
      label: 'Review',
      transactionId: rise.latest.id,
    });
  }

  const unsure = nextUnsure(budget);
  const toCheck = (unsure?.remaining ?? 0) + (budget.questions?.length ?? 0);
  if (toCheck > 0) {
    insights.push({
      id: 'sort',
      title: unsure ? `What's ${tidyName(unsure.transaction.description)}?` : 'Same purchase?',
      detail: `${toCheck} to sort`,
      action: 'sort',
      label: 'Answer',
    });
  }

  // Only a receipt can promise a renewal. A pattern might just be a habit
  const renewal = upcomingBills(budget, today).find((bill) => bill.stated);
  const daysUntil = renewal ? Math.round((Date.parse(renewal.date) - Date.parse(today)) / 86_400_000) : Infinity;
  if (renewal && daysUntil <= RENEWAL_WARNING_DAYS) {
    insights.push({
      id: `renews-${renewal.name}-${renewal.date}`,
      title: `${renewal.name} renews ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
      detail: `${formatMoney(renewal.amount)} a ${renewal.every === 'yearly' ? 'year' : renewal.every === 'weekly' ? 'week' : 'month'}`,
      action: 'bills',
      label: 'Review',
    });
  }

  if (budget.income === 0) {
    insights.push({ id: 'income', title: 'What comes in each month?', detail: '', action: 'income', label: 'Add it' });
  }

  const sources = new Set(budget.transactions.map((transaction) => transaction.source));
  if (sources.has('mail') && !sources.has('wallet')) {
    insights.push({ id: 'wallet', title: 'Apple Pay taps leave no receipt', detail: '', action: 'wallet', label: 'Connect' });
  }
  if (sources.has('mail') && !sources.has('bank')) {
    insights.push({ id: 'bank', title: 'Email misses most card purchases', detail: '', action: 'bank', label: 'Connect bank' });
  }

  const closing = upcomingDeadlines(budget, today).find((deadline) => deadline.kind !== 'refund');
  if (closing && Date.parse(closing.date) - Date.parse(today) <= RENEWAL_WARNING_DAYS * 86_400_000) {
    insights.push({
      id: `deadline-${closing.what}-${closing.date}`,
      title: `${deadlineTitle(closing)}${closing.kind === 'trial' ? '' : ' by'} ${shortDate(closing.date)}`,
      detail: closing.amount ? formatMoney(closing.amount) : '',
      action: 'bills',
      label: 'Review',
    });
  }

  const summary = monthSummary(budget, month);
  const typical = typicalSpending(budget);
  const over = budget.categories
    .map((category) => ({ ...category, amount: (summary.spentByCategory[category.id] ?? 0) - category.planned }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0];
  if (over) {
    const usual = Math.ceil((typical[over.id] ?? 0) / 10) * 10;
    insights.push(usual > over.planned
      ? {
        id: `raise-${over.id}`,
        title: `${over.name}: usually ${formatMoney(usual)}`,
        detail: `Budget says ${formatMoney(over.planned)}`,
        action: 'approve',
        label: 'Approve',
        change: { categoryId: over.id, amount: usual },
      }
      : {
        id: 'over',
        title: `${over.name} is ${formatMoney(over.amount)} over`,
        detail: '',
        action: 'category',
        label: 'Review',
        categoryId: over.id,
      });
  }

  const free = budget.income - totalPlanned(budget);
  if (free > 100) {
    insights.push({
      id: 'free',
      title: `${formatMoney(free)} a month not budgeted`,
      detail: '',
      action: 'plan',
      label: 'Plan it',
      prompt: `I have ${formatMoney(free)} a month left over. Where should it go?`,
    });
  } else if (free < -100 && budget.income > 0) {
    // Email shows spending but not pay, so with no income known there's nothing to compare
    insights.push({
      id: 'short',
      title: `You budget ${formatMoney(-free)} more than comes in`,
      detail: '',
      action: 'plan',
      label: 'Fix it',
      prompt: `I'm spending ${formatMoney(-free)} a month more than I bring in. Help me fix it.`,
    });
  }

  return insights;
}

/** The agent's own record of what it has done, for trust. */
export function agentLog(budget: Budget | null): string[] {
  if (!budget || budget.transactions.length === 0) return [];
  const count = (source: keyof typeof SOURCE_LABELS) => budget.transactions.filter((transaction) => transaction.source === source).length;
  const sorted = budget.transactions.filter((transaction) => transaction.sure).length;
  const log = [
    count('mail') > 0 ? `Read ${count('mail')} purchases from your email` : '',
    count('wallet') > 0 ? `Logged ${count('wallet')} Apple Pay ${count('wallet') === 1 ? 'tap' : 'taps'}` : '',
    count('statement') + count('agent') > 0 ? `Read ${count('statement') + count('agent')} lines from your statements` : '',
    `Sorted ${sorted} into categories`,
  ];
  return log.filter(Boolean);
}
