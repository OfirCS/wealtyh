import { CHARGES_A_MONTH, monthlyRenewals, nextCharge, tidyName, upcomingBills } from './agent-insights';
import { categoryName, chargeKey, daysInMonth, monthSummary, purchaseRhythms, repeatingCharges, totalPlanned } from './budget';
import type { Budget, Transaction } from './budget';
import { formatMoney } from './money';
import type { Repeats } from './statement';

export interface MonthBill {
  key: string;
  name: string;
  amount: number;
  /** When it was paid, or when it's due. YYYY-MM-DD */
  date: string;
  paid: boolean;
  every: Repeats;
  /** The name on the statement, which is what a rule about this bill has to match. */
  merchant: string;
  /** The purchase behind it, once it's been paid. */
  purchaseId?: string;
}

export interface EverydayRow {
  id: string;
  name: string;
  /** What's budgeted here once this category's bills are taken out. */
  planned: number;
  spent: number;
  left: number;
}

/** One month, the way a person thinks about it: what's fixed, what's flexible, and what was a one-off. */
export interface MonthPicture {
  bills: MonthBill[];
  billsTotal: number;
  billsPaid: number;
  everyday: EverydayRow[];
  everydayPlanned: number;
  /** What can still be spent, with every bill still to come covered first. */
  spendable: number;
  everydaySpent: number;
  oneTime: Transaction[];
  oneTimeTotal: number;
  planned: number;
  spent: number;
  left: number;
}

// Budgets round up to the nearest ten, so less than this is rounding, not room to spend
const ROUNDING_LEFTOVER = 10;
const UTILITIES_NAME = 'Utilities';

function billName(charge: Transaction): string {
  return charge.repeats ? charge.description : tidyName(charge.description);
}

/** "Bills" is the name of the whole section now, so the category needs its own. */
export function everydayName(id: string, name: string): string {
  return id === 'bills' && name === 'Bills' ? UTILITIES_NAME : name;
}

/** What a category is called right now, renames included. */
export function categoryLabel(budget: Pick<Budget, 'categories'>, id: string): string {
  return everydayName(id, budget.categories.find((category) => category.id === id)?.name ?? categoryName(id));
}

/** When a bill falls in a month. One that's late stays on the list until it turns up. */
function dueIn(latest: Transaction, every: Repeats, month: string, today: string): string | null {
  if (every === 'monthly') {
    const day = Math.min(Number(latest.date.slice(8, 10)), daysInMonth(month));
    return `${month}-${String(day).padStart(2, '0')}`;
  }
  const next = nextCharge(latest.date, every, today);
  return next.startsWith(month) ? next : null;
}

function monthBills(budget: Budget, month: string, today: string): MonthBill[] {
  const rhythms = purchaseRhythms(budget);
  const paid = new Map<string, Transaction[]>();
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(month) || transaction.amount <= 0 || rhythms.get(transaction.id) !== 'bill') continue;
    const key = chargeKey(transaction);
    paid.set(key, [...(paid.get(key) ?? []), transaction]);
  }

  const bills: MonthBill[] = [...paid.entries()].map(([key, charges]) => {
    const latest = charges[charges.length - 1];
    return {
      key,
      name: billName(latest),
      amount: charges.reduce((sum, charge) => sum + charge.amount, 0),
      date: latest.date,
      paid: true,
      every: latest.repeats ?? 'monthly',
      merchant: latest.description,
      purchaseId: latest.id,
    };
  });

  if (month >= today.slice(0, 7)) {
    for (const [key, latest] of repeatingCharges(budget, today)) {
      if (paid.has(key)) continue;
      const every = latest.repeats ?? 'monthly';
      const stated = latest.renews && latest.renews >= today ? latest.renews : null;
      const date = stated ?? dueIn(latest, every, month, today);
      if (date?.startsWith(month)) bills.push({ key, name: billName(latest), amount: latest.amount, date, paid: false, every, merchant: latest.description });
    }
  }
  return bills.sort((a, b) => a.date.localeCompare(b.date));
}

export function monthPicture(budget: Budget, month: string, today: string): MonthPicture {
  const summary = monthSummary(budget, month);
  const rhythms = purchaseRhythms(budget);
  const bills = monthBills(budget, month, today);

  const spent = new Map<string, number>();
  const oneTime: Transaction[] = [];
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(month)) continue;
    const rhythm = rhythms.get(transaction.id);
    if (rhythm === 'once') oneTime.push(transaction);
    else if (rhythm === 'everyday') spent.set(transaction.categoryId, (spent.get(transaction.categoryId) ?? 0) + transaction.amount);
  }

  // A bill is budgeted inside its category, so take it out to see what's really flexible
  const forBills = new Map<string, number>();
  for (const charge of repeatingCharges(budget, today).values()) {
    forBills.set(charge.categoryId, (forBills.get(charge.categoryId) ?? 0) + charge.amount * CHARGES_A_MONTH[charge.repeats ?? 'monthly']);
  }

  const known = budget.categories.map((category) => {
    const planned = Math.max(0, category.planned - (forBills.get(category.id) ?? 0));
    const used = spent.get(category.id) ?? 0;
    return { id: category.id, name: everydayName(category.id, category.name), planned, spent: used, left: planned - used };
  });
  const unplanned = [...spent.entries()]
    .filter(([id]) => !budget.categories.some((category) => category.id === id))
    .map(([id, used]) => ({ id, name: id, planned: 0, spent: used, left: -used }));
  const everyday = [...known, ...unplanned]
    .filter((row) => row.planned >= ROUNDING_LEFTOVER || row.spent !== 0)
    .sort((a, b) => Number(budget.pinned?.includes(b.id) ?? false) - Number(budget.pinned?.includes(a.id) ?? false) || Math.max(b.planned, b.spent) - Math.max(a.planned, a.spent));

  const billsTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const billsPaid = bills.filter((bill) => bill.paid).reduce((sum, bill) => sum + bill.amount, 0);
  const everydayPlanned = everyday.reduce((sum, row) => sum + row.planned, 0);
  const everydaySpent = everyday.reduce((sum, row) => sum + row.spent, 0);

  return {
    bills,
    billsTotal,
    billsPaid,
    everyday,
    everydayPlanned,
    everydaySpent,
    // The headline should equal the rows under it, to the dollar. Bills still to come aren't free money
    spendable: Math.min(everyday.reduce((sum, row) => sum + Math.round(row.left), 0), summary.left - (billsTotal - billsPaid)),
    oneTime: oneTime.sort((a, b) => b.date.localeCompare(a.date)),
    oneTimeTotal: summary.oneTime,
    planned: summary.planned,
    spent: summary.spent,
    left: summary.left,
  };
}

/** What's safe to spend each day once the bills still to come are covered. */
export function dailyRoom(picture: MonthPicture, month: string, today: string): number {
  if (today.slice(0, 7) !== month) return 0;
  const daysLeft = daysInMonth(month) - Number(today.slice(8, 10)) + 1;
  return Math.max(0, Math.floor(picture.spendable / daysLeft));
}

export interface Headline {
  amount: number;
  label: string;
  /** How that spreads over the days left, when it means anything. */
  rate: string | null;
  over: boolean;
}

/** The one number someone opens the app for, and what it means in a few words. */
export function monthHeadline(picture: MonthPicture, month: string, today: string): Headline {
  if (month < today.slice(0, 7)) {
    return picture.left >= 0
      ? { amount: picture.left, label: 'under budget', rate: null, over: false }
      : { amount: -picture.left, label: 'over budget', rate: null, over: true };
  }
  const daysAfterToday = daysInMonth(month) - Number(today.slice(8, 10));
  if (picture.spendable < 0) {
    return { amount: -picture.spendable, label: 'over budget', rate: daysAfterToday === 0 ? 'new month tomorrow' : `new month in ${daysAfterToday + 1} days`, over: true };
  }
  const perDay = dailyRoom(picture, month, today);
  return { amount: picture.spendable, label: 'left after bills', rate: perDay >= 1 && daysAfterToday > 0 ? `${formatMoney(perDay)} a day` : null, over: false };
}

/** A whole budget in three numbers, for the moment it's first built. */
export function budgetStory(budget: Budget, today: string): { bills: number; everyday: number; oneTime: number } {
  const bills = monthlyRenewals(upcomingBills(budget, today));
  const rhythms = purchaseRhythms(budget);
  return {
    bills,
    everyday: Math.max(0, totalPlanned(budget) - bills),
    oneTime: budget.transactions.filter((item) => rhythms.get(item.id) === 'once').reduce((sum, item) => sum + item.amount, 0),
  };
}
