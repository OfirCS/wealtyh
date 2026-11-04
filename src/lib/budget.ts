import { formatMoney, getMoneyPicture } from './money';
import type { StatementRow } from './statement';
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
}

export type TransactionSource = 'statement' | 'agent' | 'wallet' | 'mail' | 'typed';

export const SOURCE_LABELS: Record<TransactionSource, string> = {
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
}

/** Money in that isn't a refund. Never counted as spending. */
export const INCOME_ID = 'income';
/** Moves between the user's own accounts. Never counted as spending. */
export const TRANSFER_ID = 'transfer';
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
  [OTHER_ID]: 'Other',
};

/** Choices offered when the user sorts a charge by hand. */
export const SORTABLE_CATEGORIES = Object.entries(CATEGORY_NAMES)
  .filter(([id]) => id !== OTHER_ID)
  .map(([id, name]) => ({ id, name }));

export function categoryName(id: string): string {
  if (id === TRANSFER_ID) return 'Not counted';
  if (id === INCOME_ID) return 'Money in';
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

function toTransaction(row: StatementRow, merchantRules: Record<string, string>, source: TransactionSource): Transaction {
  const { categoryId, sure } = categorize(row.description, merchantRules);
  const isMoneyIn = row.amount < 0 && !sure;
  return {
    id: `${row.date}|${row.description}|${row.amount}`,
    date: row.date,
    description: row.description,
    amount: row.amount,
    categoryId: isMoneyIn ? INCOME_ID : categoryId,
    sure: isMoneyIn ? true : sure,
    source,
  };
}

/** Whole months of history, so a two-month statement divides by exactly two. */
function monthsBetween(first: string, last: string): number {
  const days = (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1;
  return Math.max(1, Math.round(days / 30.4));
}

function roundUp(value: number, to: number): number {
  return Math.ceil(value / to) * to;
}

function countsAsSpending(transaction: Transaction): boolean {
  return transaction.categoryId !== INCOME_ID && transaction.categoryId !== TRANSFER_ID;
}

export interface ImportSummary {
  count: number;
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

// Under two weeks of history, the monthly amounts are only a first guess
const ENOUGH_DAYS = 14;

/** What the agent says after adding data, in plain and honest words. */
export function importMessage(summary: ImportSummary): string {
  const added = `All done! I added ${summary.count} ${summary.count === 1 ? 'purchase' : 'purchases'}.`;
  if (summary.coveredDays < ENOUGH_DAYS) {
    return `${added} That's only ${summary.coveredDays} ${summary.coveredDays === 1 ? 'day' : 'days'} of spending, so the budget is a first guess. Add more and it gets better.`;
  }
  const income = summary.monthlyIncome > 0 ? ` and bring in about ${formatMoney(summary.monthlyIncome)}` : '';
  return `${added} You spend about ${formatMoney(summary.monthlySpend)} a month${income}.`;
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
  const known = new Set(existing?.transactions.map((transaction) => transaction.id));
  const incoming = rows.map((row) => toTransaction(row, merchantRules, source)).filter((transaction) => !known.has(transaction.id));
  const transactions = [...(existing?.transactions ?? []), ...incoming].sort((a, b) => a.date.localeCompare(b.date));

  const span = transactions.length > 0 ? monthsBetween(transactions[0].date, transactions[transactions.length - 1].date) : 1;
  const totals = new Map<string, number>();
  let moneyIn = 0;
  for (const transaction of transactions) {
    if (transaction.categoryId === INCOME_ID) moneyIn -= transaction.amount;
    else if (countsAsSpending(transaction)) totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount);
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

  const monthlySpend = averages.reduce((sum, { average }) => sum + average, 0);
  const monthlyIncome = moneyIn > 0 ? moneyIn / span : fallbackIncome;

  return {
    budget: {
      income: existing?.income || Math.round(monthlyIncome),
      categories,
      transactions,
      merchantRules,
    },
    summary: {
      count: incoming.length,
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
  spent: number;
  planned: number;
  left: number;
}

export function monthSummary(budget: Budget, month: string): MonthSummary {
  const spentByCategory: Record<string, number> = {};
  let spent = 0;
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(month) || !countsAsSpending(transaction)) continue;
    spentByCategory[transaction.categoryId] = (spentByCategory[transaction.categoryId] ?? 0) + transaction.amount;
    spent += transaction.amount;
  }
  const planned = totalPlanned(budget);
  return { spentByCategory, spent, planned, left: planned - spent };
}

/** One category's spending in each month of a year, for the year sheet. */
export function yearSummary(budget: Budget, year: number): Record<string, Record<string, number>> {
  const byCategory: Record<string, Record<string, number>> = {};
  for (const transaction of budget.transactions) {
    if (!transaction.date.startsWith(String(year)) || !countsAsSpending(transaction)) continue;
    const month = transaction.date.slice(0, 7);
    const months = (byCategory[transaction.categoryId] ??= {});
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

/** Sorts every charge from one merchant, now and in future imports. */
export function sortMerchant(budget: Budget, description: string, categoryId: string): Budget {
  const key = merchantKey(description);
  const hasCategory = categoryId === TRANSFER_ID || budget.categories.some((category) => category.id === categoryId);
  return {
    ...budget,
    merchantRules: { ...budget.merchantRules, [key]: categoryId },
    transactions: budget.transactions.map((transaction) => (
      merchantKey(transaction.description) === key ? { ...transaction, categoryId, sure: true } : transaction
    )),
    categories: hasCategory ? budget.categories : [...budget.categories, { id: categoryId, name: categoryName(categoryId), planned: 0 }],
  };
}

/** The next charge the agent isn't sure about, with how many share its merchant. */
export function nextUnsure(budget: Budget): { transaction: Transaction; sameMerchant: number; remaining: number } | null {
  const unsure = budget.transactions.filter((transaction) => !transaction.sure);
  if (unsure.length === 0) return null;
  const transaction = unsure[0];
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
