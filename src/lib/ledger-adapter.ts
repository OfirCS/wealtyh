import { answerSamePurchase, displayName, reconcile, withdraw } from '@/core/ledger';
import type { MoneyKind, Purchase, SamePurchaseQuestion, Sighting, SourceKind } from '@/core/ledger';
import type { Budget, Transaction, TransactionSource } from './budget';
import { INCOME_ID, TRANSFER_ID } from './budget';
import type { StatementRow } from './statement';

// The budget in src/lib speaks dollars and transactions. The ledger speaks cents and sightings.
// This file is the only place that knows both, so either side can change without the other.

const SOURCE_KINDS: Record<TransactionSource, SourceKind> = { bank: 'bank', statement: 'statement', agent: 'statement', wallet: 'wallet', mail: 'receipt', typed: 'typed' };
const PROVIDERS: Record<TransactionSource, string> = { bank: 'plaid', statement: 'csv', agent: 'pdf', wallet: 'shortcut', mail: 'gmail', typed: 'typed' };
const SOURCES: Record<SourceKind, TransactionSource> = { bank: 'bank', statement: 'statement', wallet: 'wallet', receipt: 'mail', typed: 'typed' };
const SOURCE_ORDER: SourceKind[] = ['bank', 'receipt', 'wallet', 'statement', 'typed'];

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function kindOf(transaction: Transaction): MoneyKind {
  if (transaction.categoryId === TRANSFER_ID) return 'transfer';
  if (transaction.categoryId === INCOME_ID) return 'income';
  return transaction.amount < 0 ? 'refund' : 'spending';
}

/** What a row of the budget looks like to the ledger. Rows saved by older versions have no sightings. */
export function sightingFromTransaction(transaction: Transaction, id = transaction.id): Sighting {
  const source = transaction.source ?? 'statement';
  return {
    id,
    source: SOURCE_KINDS[source],
    provider: PROVIDERS[source],
    date: transaction.date,
    amountCents: toCents(transaction.amount),
    currency: 'CAD',
    merchant: transaction.description,
    kind: kindOf(transaction),
    categoryId: transaction.categoryId,
    sure: transaction.sure,
    ...(transaction.repeats ? { repeats: transaction.repeats } : {}),
    ...(transaction.renews ? { renews: transaction.renews } : {}),
    ...(transaction.once ? { once: true } : {}),
  };
}

function purchaseFromTransaction(transaction: Transaction, id = transaction.id): Purchase {
  return {
    id,
    date: transaction.date,
    amountCents: toCents(transaction.amount),
    currency: transaction.currency ?? 'CAD',
    merchant: transaction.description,
    kind: kindOf(transaction),
    categoryId: transaction.categoryId,
    sure: transaction.sure,
    repeats: transaction.repeats,
    renews: transaction.renews,
    ...(transaction.once !== undefined ? { once: transaction.once } : {}),
    pending: transaction.pending ?? false,
    sightings: transaction.sightings?.length ? transaction.sightings : [sightingFromTransaction(transaction, id)],
    ...(transaction.locked ? { locked: transaction.locked } : {}),
    ...(transaction.split ? { split: transaction.split } : {}),
    ...(transaction.refundOf ? { refundOf: transaction.refundOf } : {}),
  };
}

function categoryOf(purchase: Purchase): string {
  if (purchase.kind === 'transfer') return TRANSFER_ID;
  if (purchase.kind === 'income') return INCOME_ID;
  return purchase.categoryId ?? 'other';
}

function transactionFromPurchase(purchase: Purchase): Transaction {
  const kinds = new Set(purchase.sightings.map((sighting) => sighting.source));
  const source = SOURCE_ORDER.find((kind) => kinds.has(kind)) ?? 'typed';
  return {
    id: purchase.id,
    date: purchase.date,
    description: purchase.merchant,
    amount: purchase.amountCents / 100,
    categoryId: categoryOf(purchase),
    sure: purchase.sure,
    source: SOURCES[source],
    sightings: purchase.sightings,
    ...(purchase.currency !== 'CAD' ? { currency: purchase.currency } : {}),
    ...(purchase.pending ? { pending: true } : {}),
    ...(purchase.repeats ? { repeats: purchase.repeats } : {}),
    ...(purchase.renews ? { renews: purchase.renews } : {}),
    ...(purchase.once !== undefined ? { once: purchase.once } : {}),
    ...(purchase.locked ? { locked: purchase.locked } : {}),
    ...(purchase.split ? { split: true } : {}),
    ...(purchase.refundOf ? { refundOf: purchase.refundOf } : {}),
  };
}

/** Older budgets could hold identical rows under one id. Giving them distinct ids keeps them distinct. */
function purchasesFrom(transactions: Transaction[], removed = false): Purchase[] {
  const seen = new Map<string, number>();
  return transactions.map((transaction) => {
    const count = (seen.get(transaction.id) ?? 0) + 1;
    seen.set(transaction.id, count);
    const purchase = purchaseFromTransaction(transaction, count === 1 ? transaction.id : `${transaction.id}|${count}`);
    return removed ? { ...purchase, removed: true } : purchase;
  });
}

export interface LedgerUpdate {
  transactions: Transaction[];
  deleted: Transaction[];
  /** Purchases that weren't known before. */
  added: Transaction[];
  merged: number;
  questions: SamePurchaseQuestion[];
}

/** Folds new sightings into the budget's rows. */
export function foldSightings(budget: Pick<Budget, 'transactions' | 'deleted'> | null, sightings: Sighting[]): LedgerUpdate {
  const existing = [...purchasesFrom(budget?.transactions ?? []), ...purchasesFrom(budget?.deleted ?? [], true)];
  const before = new Set(existing.map((purchase) => purchase.id));
  const { purchases, merged, questions } = reconcile(existing, sightings);
  const live = purchases.filter((purchase) => !purchase.removed).map(transactionFromPurchase);
  return {
    transactions: live.sort((a, b) => a.date.localeCompare(b.date)),
    deleted: purchases.filter((purchase) => purchase.removed).map(transactionFromPurchase),
    added: live.filter((transaction) => !before.has(transaction.id)),
    merged,
    questions,
  };
}

/** A source took these back, such as a pending charge that never posted. */
export function withdrawSightings(budget: Budget, ids: string[]): Budget {
  if (ids.length === 0) return budget;
  return { ...budget, transactions: withdraw(purchasesFrom(budget.transactions), ids).map(transactionFromPurchase) };
}

/** Sightings the server sent, ready to go through the same import as everything else. */
export function rowsFromSightings(sightings: Sighting[]): StatementRow[] {
  return sightings.map((sighting) => ({
    date: sighting.date,
    description: sighting.source === 'bank' ? displayName(sighting.merchant) : sighting.merchant,
    amount: sighting.amountCents / 100,
    sighting,
    ...(sighting.kind === 'transfer' ? { category: TRANSFER_ID } : sighting.kind === 'income' ? { category: INCOME_ID } : sighting.categoryId ? { category: sighting.categoryId } : {}),
    ...(sighting.repeats ? { repeats: sighting.repeats } : {}),
    ...(sighting.renews ? { renews: sighting.renews } : {}),
    ...(sighting.once ? { once: true } : {}),
  }));
}

/** "Same purchase?" Either answer clears the question, and yes folds the two rows into one. */
export function answerQuestion(budget: Budget, question: SamePurchaseQuestion, same: boolean): Budget {
  const remaining = (budget.questions ?? []).filter((item) => item !== question && item.sighting.id !== question.sighting.id);
  const transactions = answerSamePurchase(purchasesFrom(budget.transactions), question, same).map(transactionFromPurchase);
  return { ...budget, questions: remaining, transactions: transactions.sort((a, b) => a.date.localeCompare(b.date)) };
}
