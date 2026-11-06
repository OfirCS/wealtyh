// One purchase, many sightings. A bank line, a receipt and an Apple Pay tap are
// three sightings of one purchase, so nothing is ever counted twice and each
// source adds what it knows best: the bank knows the true amount, the receipt
// knows what was bought, and the tap knows when and where.
//
// Everything in src/core is plain TypeScript: no React, no browser, no Node and
// no network. It runs the same in the browser, on the server and in a phone app.

export type SourceKind = 'bank' | 'statement' | 'wallet' | 'receipt' | 'typed';

export type MoneyKind = 'spending' | 'refund' | 'income' | 'transfer';

export type Repeats = 'weekly' | 'monthly' | 'yearly';

/** One source's report of money moving. Sightings are never edited, only added. */
export interface Sighting {
  /** Stable across re-reads, such as `plaid:abc` or `gmail:17f3:0`. Reading twice changes nothing. */
  id: string;
  source: SourceKind;
  /** Who reported it: plaid, flinks, gmail, shortcut, csv, pdf, typed. */
  provider: string;
  /** Which card, bank account or inbox. */
  accountId?: string;
  /** YYYY-MM-DD */
  date: string;
  /** Positive is money out, negative is money in. Whole cents, never a float. */
  amountCents: number;
  /** ISO code, such as CAD or USD. */
  currency: string;
  /** The name as the source wrote it, however messy. */
  merchant: string;
  /** Still pending at the bank. */
  pending?: boolean;
  /** The pending sighting this posted one replaces, when the bank says so. */
  replacesId?: string;
  kind?: MoneyKind;
  categoryId?: string;
  /** False when the category is only a guess. */
  sure?: boolean;
  repeats?: Repeats;
  /** The next charge, when the source states it. YYYY-MM-DD */
  renews?: string;
  /** What was bought. Only receipts know this. */
  items?: string[];
  /** The reader expects this to be a one-off, like a flight or a sofa. */
  once?: boolean;
}

/** What really happened, built from every sighting of it. */
export interface Purchase {
  id: string;
  date: string;
  amountCents: number;
  currency: string;
  /** The clearest name any sighting gave. */
  merchant: string;
  kind: MoneyKind;
  categoryId?: string;
  /** False while the category is a guess the user hasn't confirmed. */
  sure: boolean;
  repeats?: Repeats;
  renews?: string;
  items?: string[];
  /** Still spending, but it shouldn't shape next month's budget. */
  once?: boolean;
  pending: boolean;
  sightings: Sighting[];
  /** Fields the user set by hand. The ledger never overwrites these. */
  locked?: ('categoryId' | 'merchant' | 'amountCents' | 'date' | 'once')[];
  /** The purchase this refunds. */
  refundOf?: string;
  /** Charged in parts, such as an order shipped in two boxes, so the charges add up. */
  split?: boolean;
  /** Set when the user deleted it, so a later sighting can't bring it back. */
  removed?: boolean;
}

/** Asked only when two records might be one purchase and the money matters. */
export interface SamePurchaseQuestion {
  sighting: Sighting;
  purchaseId: string;
}

export interface ReconcileResult {
  purchases: Purchase[];
  /** New purchases. */
  added: number;
  /** Sightings folded into a purchase that already existed. */
  merged: number;
  questions: SamePurchaseQuestion[];
}
