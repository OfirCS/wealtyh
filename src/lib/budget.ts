import type { SamePurchaseQuestion, Sighting } from '@/core/ledger/types';
import { foldSightings, sightingFromTransaction } from './ledger-adapter';
import { getMoneyPicture } from './money';
import type { PointEntry } from './points';
import type { Deadline, Repeats, StatementRow } from './statement';
import type { CustomFund, FinancialProfile } from './types';

export interface BudgetCategory {
  id: string;
  name: string;
  /** Monthly budget. */
  planned: number;
}

export interface Transaction {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Positive is money spent, negative is a refund or money received. */
  amount: number;
  categoryId: string;
  /** False while the sorting rules are guessing and the user hasn't confirmed it. */
  sure: boolean;
  /** Where this row came from. Older saved rows don't have one. */
  source?: TransactionSource;
  /** How often this charges by itself, when the agent read that on the receipt. */
  repeats?: Repeats;
  /** The next charge, when the receipt states it. YYYY-MM-DD */
  renews?: string;
  /** Every source that saw this purchase. */
  sightings?: Sighting[];
  /** Still pending at the bank. */
  pending?: boolean;
  /** Left out when it's Canadian dollars. */
  currency?: string;
  /** Set when someone decided this is a one-off, or on the user's word that it isn't. */
  once?: boolean;
  /** What the user changed by hand. No import overwrites these. */
  locked?: ('categoryId' | 'merchant' | 'amountCents' | 'date' | 'once')[];
  split?: boolean;
  /** The purchase this refunds. */
  refundOf?: string;
}

export type TransactionSource = 'bank' | 'statement' | 'agent' | 'wallet' | 'mail' | 'typed';

/**
 * How a purchase sits in a family's month. Bills and everyday spending build the budget.
 * A one-off still counts as money spent, but it says nothing about next month.
 */
export type Rhythm = 'bill' | 'everyday' | 'once';

export const SOURCE_LABELS: Record<TransactionSource, string> = {
  bank: 'Bank',
  statement: 'Statement',
  agent: 'Read by agent',
  wallet: 'Apple Wallet',
  mail: 'Email',
  typed: 'Typed',
};

export interface Budget {
  /** Monthly money coming in, after tax. */
  income: number;
  categories: BudgetCategory[];
  transactions: Transaction[];
  /** Merchants the user sorted by hand, applied to everything imported later. */
  merchantRules: Record<string, string>;
  /** Purchases the user deleted, so a later import doesn't bring them back. */
  removed?: string[];
  /** The rows behind `removed`, so a bank line for a deleted purchase can't bring it back either. */
  deleted?: Transaction[];
  /** Two records that might be one purchase, waiting for the user to say. */
  questions?: SamePurchaseQuestion[];
  /** How far this device has read the server's sightings. */
  sightingsRead?: number;
  /** When each inbox was last read, so a second device doesn't read it all again. */
  inboxesChecked?: Record<string, number>;
  /** Days the user checked in, for their streak. YYYY-MM-DD */
  checkIns?: string[];
  /** Set once the user changes a budget amount, so the agent stops setting them. */
  planEdited?: boolean;
  /** Dates that could cost money if missed, read from receipts. */
  deadlines?: Deadline[];
  /** The agent's read of each merchant's history. */
  rhythms?: Record<string, Rhythm>;
  /** The same, as the user set it. These win. */
  rhythmRules?: Record<string, Rhythm>;
  /** Categories the user keeps at the top. */
  pinned?: string[];
  /** What's been earned lately. */
  points?: PointEntry[];
  /** Points from entries too old to keep. */
  pointsEarlier?: number;
}

/** Money in that isn't a refund. Never counted as spending. */
export const INCOME_ID = 'income';
/** Moves between the user's own accounts. Never counted as spending. */
export const TRANSFER_ID = 'transfer';
/** Money sent to a person. Rent or a one-off, so its history decides what it is. */
export const PEOPLE_ID = 'people';
/** The line a year shows for everything set apart as one-time. */
export const ONE_TIME_ID = 'once';
const OTHER_ID = 'other';

const CATEGORY_NAMES: Record<string, string> = {
  housing: 'Housing',
  groceries: 'Groceries',
  bills: 'Bills',
  transport: 'Transport',
  kids: 'Kids',
  health: 'Health',
  eating: 'Eating out',
  shopping: 'Shopping',
  fun: 'Fun',
  debt: 'Debt',
  [PEOPLE_ID]: 'E-transfers',
  [OTHER_ID]: 'Other',
};

/** Choices offered when the user sorts a charge by hand. */
export const SORTABLE_CATEGORIES = Object.entries(CATEGORY_NAMES)
  .filter(([id]) => id !== OTHER_ID)
  .map(([id, name]) => ({ id, name }));

export function categoryName(id: string): string {
  if (id === TRANSFER_ID) return 'Not spending';
  if (id === INCOME_ID) return 'Money in';
  if (id === ONE_TIME_ID) return 'One-time';
  return CATEGORY_NAMES[id] ?? id;
}

// Checked in order, so "uber eats" lands in eating before "uber" reaches transport
const RULES: [string, RegExp][] = [
  [TRANSFER_ID, /e-?transfer|etfr|email money|\b(transfer|tfr)\b|payment.{0,12}(visa|mastercard|amex|thank|received)|(visa|mastercard|amex).{0,12}payment|\b(wealthsimple|questrade|tfsa|rrsp contribution)\b/i],
  ['housing', /\b(rent|mortgage|property tax|condo fee|strata)\b/i],
  ['eating', /tim hortons|starbucks|mcdonald|\b(lunch|dinner|breakfast|takeout)\b|subway|\ba&w\b|wendy|burger|pizza|sushi|restaurant|\bcafe\b|coffee|bistro|\bgrill\b|\bpub\b|uber\s?eats|doordash|skip\s?the\s?dishes|\bkfc\b|popeyes|harvey|shawarma/i],
  ['groceries', /loblaw|no\s?frills|\bmetro\b|sobeys|food basics|fresh\s?co|farm boy|\bt&t\b|superstore|safeway|save.?on|\biga\b|\bmaxi\b|provigo|costco|walmart|grocer|whole foods|longo|fortinos|zehrs|foodland/i],
  ['bills', /rogers|\bbell\b|telus|\bfido\b|koodo|virgin|freedom mobile|\bshaw\b|videotron|hydro|enbridge|fortis|utilit|insurance|netflix|spotify|disney|crave|apple\.com|icloud|google one|amazon prime|prime video/i],
  ['transport', /\b(gas|fuel|taxi|bus|train)\b|\bshell\b|petro|\besso\b|ultramar|husky|pioneer|chevron|presto|\bttc\b|\bstm\b|translink|go transit|compass|\buber\b|\blyft\b|parking|impark|green\s?p\b|car wash|\b407\b/i],
  ['kids', /daycare|day care|childcare|child care|\bschool\b|tuition|\bkids?\b|\btoys?\b|\bcamp\b|\bresp\b/i],
  ['health', /shoppers|rexall|pharma|dental|dentist|doctor|clinic|physio|optical|goodlife|\bgym\b/i],
  ['shopping', /amazon|canadian tire|winners|homesense|marshalls|ikea|best buy|home depot|\blowe|the bay|old navy|\bgap\b|h&m|zara|sephora|indigo|dollarama|staples/i],
  ['fun', /cineplex|ticketmaster|steam|playstation|xbox|nintendo|airbnb|air canada|westjet|expedia|hotel|bowling|theatre/i],
  ['debt', /\bloan\b|line of credit|\bloc\b|\bosap\b|car payment/i],
];

const E_TRANSFER = /e-?\s?transfer|\betfr\b|email money|\binterac\b/i;

/** Groups "LOBLAWS #1234 TORONTO" and "LOBLAWS #88 OTTAWA" as one merchant. */
export function merchantKey(description: string): string {
  return description
    .toUpperCase()
    .replace(/[^A-Z&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ');
}

export function categorize(description: string, merchantRules: Record<string, string> = {}): { categoryId: string; sure: boolean } {
  const remembered = merchantRules[merchantKey(description)];
  if (remembered) return { categoryId: remembered, sure: true };
  const match = RULES.find(([, pattern]) => pattern.test(description));
  return match ? { categoryId: match[0], sure: true } : { categoryId: OTHER_ID, sure: false };
}

/**
 * The user's own choices win, then the agent's, then the built-in rules.
 * Email only shows money leaving, so an e-Transfer went to someone else and needs a look.
 */
function categorizeRow(row: StatementRow, merchantRules: Record<string, string>): { categoryId: string; sure: boolean } {
  const sorted = categorize(row.description, merchantRules);
  if (merchantRules[merchantKey(row.description)]) return sorted;
  if (row.category && row.category !== OTHER_ID && (row.category in CATEGORY_NAMES || row.category === TRANSFER_ID || row.category === INCOME_ID)) return { categoryId: row.category, sure: true };
  if (!row.emailed || sorted.categoryId !== TRANSFER_ID) return sorted;
  return E_TRANSFER.test(row.description) ? { categoryId: PEOPLE_ID, sure: true } : { categoryId: OTHER_ID, sure: false };
}

const SIGHTING_SOURCES: Record<Sighting['source'], TransactionSource> = { bank: 'bank', statement: 'statement', wallet: 'wallet', receipt: 'mail', typed: 'typed' };

function toTransaction(row: StatementRow, merchantRules: Record<string, string>, source: TransactionSource): Transaction {
  const { categoryId, sure } = categorizeRow(row, merchantRules);
  // A refund in an email is money coming back, never pay
  const isMoneyIn = row.amount < 0 && !sure && !row.emailed && row.sighting?.kind !== 'refund';
  return {
    id: `${row.date}|${row.description}|${row.amount}`,
    date: row.date,
    description: row.description,
    amount: row.amount,
    categoryId: isMoneyIn ? INCOME_ID : categoryId,
    sure: isMoneyIn ? true : sure,
    source: row.sighting ? SIGHTING_SOURCES[row.sighting.source] : row.tapped ? 'wallet' : source,
    ...(row.repeats ? { repeats: row.repeats } : {}),
    ...(row.renews ? { renews: row.renews } : {}),
    ...(row.once ? { once: true } : {}),
  };
}

const MONTHS_A_YEAR = 12;

/** Calendar months of history, so two months divide by exactly two, however the dates fall inside them. */
function monthsBetween(first: string, last: string): number {
  const [firstYear, firstMonth] = first.split('-').map(Number);
  const [lastYear, lastMonth] = last.split('-').map(Number);
  return (lastYear - firstYear) * MONTHS_A_YEAR + lastMonth - firstMonth + 1;
}

function roundUp(value: number, to: number): number {
  return Math.ceil(value / to) * to;
}

// A month with nothing past this day is still underway, so it would drag averages off
const SETTLED_DAY = 25;

/** The history that's fair to average: every month except one still in progress. */
function settledTransactions(transactions: Transaction[]): Transaction[] {
  const latest = transactions.at(-1)?.date;
  if (!latest || Number(latest.slice(8, 10)) >= SETTLED_DAY) return transactions;
  const settled = transactions.filter((transaction) => transaction.date.slice(0, 7) < latest.slice(0, 7));
  return settled.length > 0 ? settled : transactions;
}

export function countsAsSpending(transaction: Transaction): boolean {
  return transaction.categoryId !== INCOME_ID && transaction.categoryId !== TRANSFER_ID;
}

// Everyday shopping can repeat by chance, but it isn't a bill
export const NOT_BILLS = new Set(['groceries', 'eating', 'shopping', 'fun', TRANSFER_ID, INCOME_ID]);

/** How long a charge can go quiet before it counts as cancelled. */
const LAPSE_DAYS: Record<Repeats, number> = { weekly: 21, monthly: 62, yearly: 400 };

function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

type RhythmSource = Pick<Budget, 'transactions' | 'rhythms' | 'rhythmRules'>;

function judged(budget: RhythmSource, description: string): Rhythm | undefined {
  const key = merchantKey(description);
  return budget.rhythmRules?.[key] ?? budget.rhythms?.[key];
}

/** Groups one merchant's charges. One company can sell several plans, like two apps billed through Apple. */
export function chargeKey(transaction: Transaction): string {
  return transaction.repeats ? transaction.description.toUpperCase() : merchantKey(transaction.description);
}

/**
 * Everything that will charge again, as the latest charge from each. Three signals feed
 * this: what the agent read on a receipt, like "Renews September 3, 2027", what it made of
 * the merchant's history, and the same amount turning up month after month. Pass today to
 * leave out anything that has stopped.
 */
export function repeatingCharges(budget: RhythmSource, today?: string): Map<string, Transaction> {
  const seen = new Map<string, { latest: Transaction; months: Map<string, number> }>();
  for (const transaction of budget.transactions) {
    if (transaction.amount <= 0 || transaction.once || !countsAsSpending(transaction)) continue;
    const said = judged(budget, transaction.description);
    if (said && said !== 'bill') continue;
    if (!said && !transaction.repeats && NOT_BILLS.has(transaction.categoryId)) continue;
    const key = chargeKey(transaction);
    const entry = seen.get(key) ?? { latest: transaction, months: new Map<string, number>() };
    entry.months.set(transaction.date.slice(0, 7), transaction.amount);
    if (transaction.date >= entry.latest.date) entry.latest = transaction;
    seen.set(key, entry);
  }

  const repeating = new Map<string, Transaction>();
  for (const [key, { latest, months }] of seen) {
    if (today && daysApart(latest.date, today) > LAPSE_DAYS[latest.repeats ?? 'monthly']) continue;
    const amounts = [...months.values()];
    const steady = amounts.length >= 2 && Math.max(...amounts) <= Math.min(...amounts) * 1.15;
    if (latest.repeats || judged(budget, latest.description) === 'bill' || steady) repeating.set(key, latest);
  }
  return repeating;
}

// Food and getting around come back every month, whatever a single shop costs
const EVERYDAY_CATEGORIES = new Set(['groceries', 'eating', 'transport']);
/** Below this, something seen only once is ordinary spending, not worth setting apart. */
const ONE_OFF_FLOOR = 100;

const rhythmCache = new WeakMap<RhythmSource, Map<string, Rhythm>>();

function rhythmOf(transaction: Transaction, budget: RhythmSource, repeating: Map<string, Transaction>, months: Map<string, Set<string>>): Rhythm {
  const billed = repeating.has(chargeKey(transaction)) ? 'bill' : 'everyday';
  if (transaction.locked?.includes('once')) return transaction.once ? 'once' : billed;
  const rule = budget.rhythmRules?.[merchantKey(transaction.description)];
  if (rule) return rule;
  if (transaction.once) return 'once';
  if (billed === 'bill') return 'bill';
  const said = budget.rhythms?.[merchantKey(transaction.description)];
  if (said) return said;
  // Seen in two different months, so it's part of how this family lives
  if ((months.get(merchantKey(transaction.description))?.size ?? 0) >= 2) return 'everyday';
  if (transaction.categoryId === PEOPLE_ID || E_TRANSFER.test(transaction.description)) return 'once';
  if (EVERYDAY_CATEGORIES.has(transaction.categoryId)) return 'everyday';
  return Math.abs(transaction.amount) >= ONE_OFF_FLOOR ? 'once' : 'everyday';
}

/** What every purchase is to the budget, by id. Built from the whole history, so an old one-off stays one. */
export function purchaseRhythms(budget: RhythmSource): Map<string, Rhythm> {
  const cached = rhythmCache.get(budget);
  if (cached) return cached;

  const repeating = repeatingCharges(budget);
  const months = new Map<string, Set<string>>();
  for (const transaction of budget.transactions) {
    if (!countsAsSpending(transaction) || transaction.amount <= 0) continue;
    const key = merchantKey(transaction.description);
    months.set(key, (months.get(key) ?? new Set<string>()).add(transaction.date.slice(0, 7)));
  }

  const rhythms = new Map<string, Rhythm>();
  for (const transaction of budget.transactions) {
    if (countsAsSpending(transaction)) rhythms.set(transaction.id, rhythmOf(transaction, budget, repeating, months));
  }
  // A refund belongs wherever the purchase it undoes went
  for (const transaction of budget.transactions) {
    const original = transaction.refundOf && rhythms.get(transaction.refundOf);
    if (original) rhythms.set(transaction.id, original);
  }
  rhythmCache.set(budget, rhythms);
  return rhythms;
}

export interface ImportSummary {
  count: number;
  /** Purchases already seen from another source, so not counted again. */
  repeats: number;
  firstDate: string;
  lastDate: string;
  sorted: number;
  unsure: number;
  notCounted: number;
  regularBills: number;
  monthlySpend: number;
  monthlyIncome: number;
  /** How many days of history the budget now has. */
  coveredDays: number;
}

/** A merchant charged in two or more months for about the same amount. */
function countRegularBills(transactions: Transaction[]): number {
  const seen = new Map<string, Map<string, number>>();
  for (const transaction of transactions) {
    if (transaction.amount <= 0 || !countsAsSpending(transaction)) continue;
    const key = merchantKey(transaction.description);
    const months = seen.get(key) ?? new Map<string, number>();
    months.set(transaction.date.slice(0, 7), transaction.amount);
    seen.set(key, months);
  }
  return [...seen.values()].filter((months) => {
    const amounts = [...months.values()];
    return amounts.length >= 2 && Math.max(...amounts) <= Math.min(...amounts) * 1.15;
  }).length;
}

/** A row's id is its content, so the second of two identical rows needs a number to stay separate. */
function newSightings(rows: StatementRow[], existing: Budget | null, source: TransactionSource): Sighting[] {
  const merchantRules = existing?.merchantRules ?? {};
  const known = new Set([
    ...(existing?.transactions.flatMap((transaction) => [transaction.id, ...(transaction.sightings?.map((sighting) => sighting.id) ?? [])]) ?? []),
    ...(existing?.removed ?? []),
  ]);
  const counts = new Map<string, number>();
  return rows.flatMap((row) => {
    const transaction = toTransaction(row, merchantRules, source);
    if (row.sighting) {
      return [{ ...row.sighting, categoryId: transaction.categoryId, sure: transaction.sure, ...(row.repeats ? { repeats: row.repeats } : {}) }];
    }
    const count = (counts.get(transaction.id) ?? 0) + 1;
    counts.set(transaction.id, count);
    const id = count === 1 ? transaction.id : `${transaction.id}|${count}`;
    return known.has(id) ? [] : [sightingFromTransaction(transaction, id)];
  });
}

/**
 * Adds a statement to the budget. A brand-new budget takes its monthly amounts
 * from what was really spent. An existing one keeps the amounts the user set.
 */
export function importStatement(
  rows: StatementRow[],
  existing: Budget | null,
  fallbackIncome: number,
  source: TransactionSource = 'statement',
): { budget: Budget; summary: ImportSummary } {
  const merchantRules = existing?.merchantRules ?? {};
  const fold = foldSightings(existing, newSightings(rows, existing, source));
  const { transactions, added: incoming } = fold;

  const settled = settledTransactions(transactions);
  const span = settled.length > 0 ? monthsBetween(settled[0].date, settled[settled.length - 1].date) : 1;
  const rhythms = purchaseRhythms({ transactions, rhythms: existing?.rhythms, rhythmRules: existing?.rhythmRules });
  const totals = new Map<string, number>();
  let moneyIn = 0;
  for (const transaction of settled) {
    if (transaction.categoryId === INCOME_ID) moneyIn -= transaction.amount;
    else if (countsAsSpending(transaction) && rhythms.get(transaction.id) !== 'once') totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount);
  }

  const averages = [...totals.entries()]
    .map(([id, total]) => ({ id, average: total / span }))
    .filter(({ average }) => average > 0)
    .sort((a, b) => b.average - a.average);

  const categories: BudgetCategory[] = existing?.categories.map((category) => ({ ...category })) ?? [];
  for (const { id, average } of averages) {
    if (!categories.some((category) => category.id === id)) {
      categories.push({ id, name: categoryName(id), planned: roundUp(average, 10) });
    }
  }

  // A category first seen in the month underway still needs a row, or its spending vanishes from the sheet
  const newThisMonth = new Map<string, number>();
  for (const transaction of transactions) {
    if (!countsAsSpending(transaction) || rhythms.get(transaction.id) === 'once' || categories.some((category) => category.id === transaction.categoryId)) continue;
    newThisMonth.set(transaction.categoryId, (newThisMonth.get(transaction.categoryId) ?? 0) + transaction.amount);
  }
  for (const [id, total] of newThisMonth) {
    if (total > 0) categories.push({ id, name: categoryName(id), planned: roundUp(total, 10) });
  }

  const monthlySpend = averages.reduce((sum, { average }) => sum + average, 0);
  const monthlyIncome = moneyIn > 0 ? moneyIn / span : fallbackIncome;

  return {
    budget: {
      ...existing,
      income: existing?.income || Math.round(monthlyIncome),
      categories,
      transactions,
      merchantRules,
      ...(fold.deleted.length > 0 ? { deleted: fold.deleted } : {}),
      ...(fold.questions.length > 0 ? { questions: [...(existing?.questions ?? []), ...fold.questions] } : {}),
    },
    summary: {
      count: incoming.length,
      repeats: fold.merged,
      firstDate: incoming[0]?.date ?? '',
      lastDate: incoming[incoming.length - 1]?.date ?? '',
      sorted: incoming.filter((transaction) => transaction.sure && countsAsSpending(transaction)).length,
      unsure: incoming.filter((transaction) => !transaction.sure).length,
      notCounted: incoming.filter((transaction) => transaction.categoryId === TRANSFER_ID).length,
      regularBills: countRegularBills(transactions),
      monthlySpend: Math.round(monthlySpend),
      monthlyIncome: Math.round(monthlyIncome),
      coveredDays: transactions.length > 0
        ? Math.round((Date.parse(transactions[transactions.length - 1].date) - Date.parse(transactions[0].date)) / 86_400_000) + 1
        : 0,
    },
  };
}

// How the single "essentials" figure from Pathfinder is split for a first budget
const GROCERIES_SHARE = 0.5;
const BILLS_SHARE = 0.3;

export function budgetFromProfile(profile: FinancialProfile, customFunds: CustomFund[] = []): Budget {
  const groceries = Math.round(profile.essentialExpenses * GROCERIES_SHARE);
  const bills = Math.round(profile.essentialExpenses * BILLS_SHARE);
  const planned: [string, number][] = [
    ['housing', profile.housingExpense],
    ['groceries', groceries],
    ['bills', bills],
    ['transport', profile.essentialExpenses - groceries - bills],
    ['fun', profile.discretionarySpending],
    ['debt', profile.debtPayments],
  ];

  return {
    income: Math.round(getMoneyPicture(profile, customFunds).monthlyTakeHome),
    categories: planned
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => ({ id, name: categoryName(id), planned: amount })),
    transactions: [],
    merchantRules: {},
  };
}

/** Feeds the budget back into Pathfinder, so plans use real spending. */
export function profileWithBudget(profile: FinancialProfile, budget: Budget): FinancialProfile {
  const sum = (ids: string[]) => budget.categories
    .filter((category) => ids.includes(category.id))
    .reduce((total, category) => total + category.planned, 0);
  const known = ['housing', 'debt', 'eating', 'shopping', 'fun'];

  return {
    ...profile,
    housingExpense: sum(['housing']),
    debtPayments: sum(['debt']),
    discretionarySpending: sum(['eating', 'shopping', 'fun']),
    essentialExpenses: budget.categories
      .filter((category) => !known.includes(category.id))
      .reduce((total, category) => total + category.planned, 0),
  };
}

export function totalPlanned(budget: Budget): number {
  return budget.categories.reduce((sum, category) => sum + category.planned, 0);
}

export interface MonthSummary {
  spentByCategory: Record<string, number>;
  /** Spent against the budget. One-time purchases sit apart, in `oneTime`. */
  spent: number;
  planned: number;
  left: number;
  oneTime: number;
}

export function monthSummary(budget: Budget, month: string): MonthSummary {
  const rhythms = purchaseRhythms(budget);
  const spentByCategory: Record<string, number> = {};
  let spent = 0;
  let oneTime = 0;
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(month) || !countsAsSpending(transaction)) continue;
    if (rhythms.get(transaction.id) === 'once') {
      oneTime += transaction.amount;
      continue;
    }
    spentByCategory[transaction.categoryId] = (spentByCategory[transaction.categoryId] ?? 0) + transaction.amount;
    spent += transaction.amount;
  }
  const planned = totalPlanned(budget);
  return { spentByCategory, spent, planned, left: planned - spent, oneTime };
}

export interface DayPoint {
  /** Day of the month. */
  day: number;
  /** Everything spent so far this month. */
  total: number;
}

/** Running total for each day of a month, up to `lastDay`. */
export function dailySpending(budget: Budget, month: string, lastDay: number): DayPoint[] {
  const rhythms = purchaseRhythms(budget);
  const byDay = new Map<number, number>();
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(month) || !countsAsSpending(transaction) || rhythms.get(transaction.id) === 'once') continue;
    const day = Number(transaction.date.slice(8, 10));
    byDay.set(day, (byDay.get(day) ?? 0) + transaction.amount);
  }
  let total = 0;
  return Array.from({ length: lastDay }, (_, index) => {
    total += byDay.get(index + 1) ?? 0;
    return { day: index + 1, total };
  });
}

export function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index, 0).getDate();
}

/** One category's spending in each month of a year, for the year sheet. */
export function yearSummary(budget: Budget, year: number): Record<string, Record<string, number>> {
  const rhythms = purchaseRhythms(budget);
  const byCategory: Record<string, Record<string, number>> = {};
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(String(year)) || !countsAsSpending(transaction)) continue;
    const month = transaction.date.slice(0, 7);
    const months = (byCategory[rhythms.get(transaction.id) === 'once' ? ONE_TIME_ID : transaction.categoryId] ??= {});
    months[month] = (months[month] ?? 0) + transaction.amount;
  }
  return byCategory;
}

/** Money received in a month, from the transactions themselves. */
export function monthIncome(budget: Budget, month: string): number {
  return budget.transactions
    .filter((transaction) => transaction.categoryId === INCOME_ID && transaction.date.startsWith(month))
    .reduce((sum, transaction) => sum - transaction.amount, 0);
}

export function emptyBudget(income = 0): Budget {
  return { income, categories: [], transactions: [], merchantRules: {} };
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split('-').map(Number);
  return monthKey(new Date(year, index - 1 + by, 1));
}

export function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

/** Opens on this month, or the latest month with spending if this one is empty. */
export function defaultMonth(budget: Budget, today: Date): string {
  const current = monthKey(today);
  const months = budget.transactions.map((transaction) => transaction.date.slice(0, 7));
  if (months.length === 0 || months.includes(current)) return current;
  return months.sort().at(-1)!;
}

export interface QuickEntry {
  amount: number;
  description: string;
}

/** Reads "45 costco", "costco 45.20" or "$12 tim hortons". */
export function parseQuickEntry(text: string): QuickEntry | null {
  const match = text.match(/\$?\s?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!(amount > 0)) return null;
  const description = text
    .replace(match[0], ' ')
    .replace(/\b(i|just|spent|paid|bought|got|on|for|at|from|dollars?|bucks?|yesterday|today)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return description ? { amount, description } : null;
}

export function addQuickEntry(
  budget: Budget,
  entry: QuickEntry,
  date: string,
  source: TransactionSource = 'typed',
): { budget: Budget; categoryId: string } {
  const { categoryId, sure } = categorize(entry.description, budget.merchantRules);
  const transaction: Transaction = {
    id: `typed|${date}|${entry.description}|${entry.amount}|${budget.transactions.length}`,
    date,
    description: entry.description,
    amount: entry.amount,
    categoryId,
    sure,
    source,
  };
  const hasCategory = budget.categories.some((category) => category.id === categoryId) || !countsAsSpending(transaction);
  return {
    categoryId,
    budget: {
      ...budget,
      transactions: [...budget.transactions, transaction],
      categories: hasCategory ? budget.categories : [...budget.categories, { id: categoryId, name: categoryName(categoryId), planned: 0 }],
    },
  };
}

export type TransactionChange = Partial<Pick<Transaction, 'date' | 'description' | 'amount' | 'categoryId' | 'once'>>;

function lockedFields(transaction: Transaction, change: TransactionChange): Transaction['locked'] {
  const fields = new Set(transaction.locked);
  if (change.categoryId !== undefined) fields.add('categoryId');
  if (change.description !== undefined) fields.add('merchant');
  if (change.amount !== undefined) fields.add('amountCents');
  if (change.date !== undefined) fields.add('date');
  if (change.once !== undefined) fields.add('once');
  return [...fields];
}

/** Changes one purchase and nothing else. Its id stays, so an import won't add it again. */
export function updateTransaction(budget: Budget, id: string, change: TransactionChange): Budget {
  const categoryId = change.categoryId;
  const needsCategory = categoryId !== undefined
    && categoryId !== TRANSFER_ID
    && categoryId !== INCOME_ID
    && !budget.categories.some((category) => category.id === categoryId);
  return {
    ...budget,
    transactions: budget.transactions
      .map((transaction) => (transaction.id === id ? { ...transaction, ...change, sure: true, locked: lockedFields(transaction, change) } : transaction))
      .sort((a, b) => a.date.localeCompare(b.date)),
    categories: needsCategory ? [...budget.categories, { id: categoryId, name: categoryName(categoryId), planned: 0 }] : budget.categories,
  };
}

export function deleteTransaction(budget: Budget, id: string): Budget {
  return {
    ...budget,
    transactions: budget.transactions.filter((transaction) => transaction.id !== id),
    removed: [...(budget.removed ?? []), id],
    deleted: [...(budget.deleted ?? []), ...budget.transactions.filter((transaction) => transaction.id === id)],
  };
}

export function setPlanned(budget: Budget, id: string, planned: number): Budget {
  return { ...budget, planEdited: true, categories: budget.categories.map((category) => (category.id === id ? { ...category, planned } : category)) };
}

export function togglePinned(budget: Budget, id: string): Budget {
  const pinned = budget.pinned ?? [];
  return { ...budget, pinned: pinned.includes(id) ? pinned.filter((item) => item !== id) : [...pinned, id] };
}

/** Takes a category out of the budget. Its purchases stay, under Other. */
export function removeCategory(budget: Budget, id: string): Budget {
  // What was in it needs somewhere to go, or it lands on a row with nothing behind it
  const moved = budget.transactions.some((transaction) => transaction.categoryId === id);
  const needsOther = moved && !budget.categories.some((category) => category.id === OTHER_ID);
  return {
    ...budget,
    planEdited: true,
    pinned: budget.pinned?.filter((item) => item !== id),
    categories: [...budget.categories.filter((category) => category.id !== id), ...(needsOther ? [{ id: OTHER_ID, name: 'Other', planned: 0 }] : [])],
    transactions: budget.transactions.map((transaction) => (transaction.categoryId === id ? { ...transaction, categoryId: OTHER_ID, locked: lockedFields(transaction, { categoryId: OTHER_ID }) } : transaction)),
  };
}

export function renameCategory(budget: Budget, id: string, name: string): Budget {
  return { ...budget, categories: budget.categories.map((category) => (category.id === id ? { ...category, name } : category)) };
}

/** What each category really costs in a typical month, from the months that are finished. One-offs don't count. */
export function typicalSpending(budget: Budget): Record<string, number> {
  const settled = settledTransactions(budget.transactions);
  if (settled.length === 0) return {};
  const span = monthsBetween(settled[0].date, settled[settled.length - 1].date);
  const rhythms = purchaseRhythms(budget);
  const totals: Record<string, number> = {};
  for (const transaction of settled) {
    if (!countsAsSpending(transaction) || rhythms.get(transaction.id) === 'once') continue;
    // A yearly charge belongs to twelve months, however short the history is
    const share = transaction.repeats === 'yearly' ? transaction.amount / MONTHS_A_YEAR : transaction.amount / span;
    totals[transaction.categoryId] = (totals[transaction.categoryId] ?? 0) + share;
  }
  return totals;
}

/** Adds newly read deadlines, keeping one of each even when two emails mention it. */
export function mergeDeadlines(budget: Budget, incoming: Deadline[]): Budget {
  if (incoming.length === 0) return budget;
  const byKey = new Map([...(budget.deadlines ?? []), ...incoming].map((deadline) => [`${deadline.kind}|${deadline.what.toLowerCase()}|${deadline.date}`, deadline]));
  return { ...budget, deadlines: [...byKey.values()] };
}

/** The agent's budget: what each category really costs, until the user sets their own. */
export function autoBudget(budget: Budget): Budget {
  if (budget.planEdited) return budget;
  const typical = typicalSpending(budget);
  const rhythms = purchaseRhythms(budget);
  const spent = new Map<string, number>();
  for (const transaction of budget.transactions) {
    if (countsAsSpending(transaction) && transaction.amount > 0 && rhythms.get(transaction.id) !== 'once') spent.set(transaction.categoryId, (spent.get(transaction.categoryId) ?? 0) + transaction.amount);
  }

  const categories = [...spent.entries()]
    .map(([id, total]) => ({
      id,
      name: budget.categories.find((category) => category.id === id)?.name ?? categoryName(id),
      planned: roundUp(typical[id] > 0 ? typical[id] : total, 10),
    }))
    .sort((a, b) => b.planned - a.planned);
  return { ...budget, categories };
}

/** Sets every budget to what that category usually costs. */
export function suggestBudgets(budget: Budget): Budget {
  const typical = typicalSpending(budget);
  return {
    ...budget,
    categories: budget.categories.map((category) => ({
      ...category,
      planned: typical[category.id] > 0 ? roundUp(typical[category.id], 10) : category.planned,
    })),
  };
}

export interface WalletTap {
  id: string;
  amount: number;
  merchant: string;
  /** YYYY-MM-DD */
  date: string;
}

/** Adds a tap from the iPhone. Seeing the same tap twice changes nothing. */
export function addWalletTap(budget: Budget, tap: WalletTap): { budget: Budget; categoryId: string | null } {
  const id = `tap|${tap.id}`;
  if (budget.transactions.some((transaction) => transaction.id === id) || budget.removed?.includes(id)) return { budget, categoryId: null };
  const { categoryId, sure } = categorize(tap.merchant, budget.merchantRules);
  const transaction: Transaction = { id, date: tap.date, description: tap.merchant, amount: tap.amount, categoryId, sure, source: 'wallet' };
  const hasCategory = budget.categories.some((category) => category.id === categoryId) || !countsAsSpending(transaction);
  return {
    categoryId,
    budget: {
      ...budget,
      transactions: [...budget.transactions, transaction].sort((a, b) => a.date.localeCompare(b.date)),
      categories: hasCategory ? budget.categories : [...budget.categories, { id: categoryId, name: categoryName(categoryId), planned: 0 }],
    },
  };
}

/** The user's word on one merchant, now and in future imports. */
export function setMerchantRhythm(budget: Budget, description: string, rhythm: Rhythm): Budget {
  return { ...budget, rhythmRules: { ...budget.rhythmRules, [merchantKey(description)]: rhythm } };
}

/** E-transfers used to land in Other, where nobody could tell what they were. */
export function sortTransfersToPeople(budget: Budget): Budget {
  const moved = (transaction: Transaction) => transaction.categoryId === OTHER_ID && !transaction.locked?.includes('categoryId') && E_TRANSFER.test(transaction.description);
  if (!budget.transactions.some(moved)) return budget;
  return {
    ...budget,
    transactions: budget.transactions.map((transaction) => (moved(transaction) ? { ...transaction, categoryId: PEOPLE_ID, sure: true, locked: lockedFields(transaction, { categoryId: PEOPLE_ID }) } : transaction)),
  };
}

/** Sorts every charge from one merchant, now and in future imports. */
export function sortMerchant(budget: Budget, description: string, categoryId: string): Budget {
  const key = merchantKey(description);
  const hasCategory = categoryId === TRANSFER_ID || budget.categories.some((category) => category.id === categoryId);
  return {
    ...budget,
    merchantRules: { ...budget.merchantRules, [key]: categoryId },
    transactions: budget.transactions.map((transaction) => (
      merchantKey(transaction.description) === key ? { ...transaction, categoryId, sure: true, locked: lockedFields(transaction, { categoryId }) } : transaction
    )),
    categories: hasCategory ? budget.categories : [...budget.categories, { id: categoryId, name: categoryName(categoryId), planned: 0 }],
  };
}

/** The next charge the agent isn't sure about, with how many share its merchant. */
export function nextUnsure(budget: Budget): { transaction: Transaction; sameMerchant: number; remaining: number } | null {
  const unsure = budget.transactions.filter((transaction) => !transaction.sure);
  if (unsure.length === 0) return null;
  // The biggest money first, so one answer settles as much of the budget as possible
  const totals = new Map<string, number>();
  for (const item of unsure) totals.set(merchantKey(item.description), (totals.get(merchantKey(item.description)) ?? 0) + Math.abs(item.amount));
  const biggest = [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const transaction = unsure.find((item) => merchantKey(item.description) === biggest) ?? unsure[0];
  const key = merchantKey(transaction.description);
  return {
    transaction,
    sameMerchant: unsure.filter((item) => merchantKey(item.description) === key).length,
    remaining: new Set(unsure.map((item) => merchantKey(item.description))).size,
  };
}

const STORAGE_KEY = 'pathfinder.budget.v1';

export function loadBudget(): Budget | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Budget) : null;
  } catch {
    return null;
  }
}

export function saveBudget(budget: Budget | null): void {
  try {
    if (budget) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}
