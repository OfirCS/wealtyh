import { displayName, sameMerchant } from './merchant';
import type { SameMerchant } from './merchant';
import type { MoneyKind, Purchase, ReconcileResult, SamePurchaseQuestion, Sighting, SourceKind } from './types';

const DAY_MS = 86_400_000;

/** A bank line can post this long after the purchase. */
const BANK_LAG_DAYS = 5;
const BANK_EARLY_DAYS = 1;
/** Two records of the moment of purchase, like a tap and a receipt. */
const SAME_MOMENT_DAYS = 3;
/** An order shipped in boxes is charged as each one leaves. */
const SPLIT_DAYS = 10;
const REFUND_DAYS = 120;
const TRANSFER_DAYS = 3;
/** A tip or a final price can push a charge past what the receipt said. */
const MAX_TIP_RATIO = 1.3;
const USD_TO_CAD = { low: 1.2, high: 1.55 };
/** Enough for any real order, and small enough to try every combination. */
const MAX_SPLIT_CANDIDATES = 12;

const MONEY_ORDER: Record<SourceKind, number> = { bank: 0, statement: 2, wallet: 3, receipt: 4, typed: 5 };
const NAME_ORDER: Record<SourceKind, number> = { receipt: 0, typed: 1, wallet: 2, bank: 3, statement: 4 };
const CATEGORY_ORDER: Record<SourceKind, number> = { receipt: 0, bank: 1, wallet: 2, statement: 3, typed: 4 };

function days(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

function moneyRank(sighting: Sighting): number {
  return MONEY_ORDER[sighting.source] + (sighting.pending ? 1 : 0);
}

function isLedger(sighting: Sighting): boolean {
  return sighting.source === 'bank' || sighting.source === 'statement';
}

/** One feed lists each purchase once, so two different rows from it are two purchases. */
function sameFeed(a: Sighting, b: Sighting): boolean {
  return a.source === b.source && (a.source === 'bank' || a.provider === b.provider);
}

function isPendingPair(a: Sighting, b: Sighting): boolean {
  return a.source === 'bank' && b.source === 'bank' && a.accountId === b.accountId && Boolean(a.pending) !== Boolean(b.pending);
}

function closeInSize(a: Sighting, b: Sighting): boolean {
  if (Math.sign(a.amountCents) !== Math.sign(b.amountCents)) return false;
  const [small, large] = [Math.abs(a.amountCents), Math.abs(b.amountCents)].sort((x, y) => x - y);
  if (a.currency === b.currency) return large <= small * MAX_TIP_RATIO;
  return large <= small * USD_TO_CAD.high;
}

type Agreement = 'exact' | 'near' | null;

function amountsAgree(a: Sighting, b: Sighting, merchant: SameMerchant): Agreement {
  if (a.currency === b.currency) {
    if (a.amountCents === b.amountCents) return 'exact';
    const [truer, other] = moneyRank(a) <= moneyRank(b) ? [a, b] : [b, a];
    const higher = Math.abs(truer.amountCents) > Math.abs(other.amountCents);
    return merchant === 'yes' && isLedger(truer) && higher ? 'near' : null;
  }
  const cad = [a, b].find((item) => item.currency === 'CAD');
  const usd = [a, b].find((item) => item.currency === 'USD');
  if (merchant !== 'yes' || !cad || !usd) return null;
  const rate = cad.amountCents / usd.amountCents;
  return rate >= USD_TO_CAD.low && rate <= USD_TO_CAD.high ? 'near' : null;
}

function inWindow(a: Sighting, b: Sighting, strong: boolean): boolean {
  if (isLedger(a) && isLedger(b)) return Math.abs(days(a.date, b.date)) <= BANK_LAG_DAYS;
  if (!isLedger(a) && !isLedger(b)) return Math.abs(days(a.date, b.date)) <= SAME_MOMENT_DAYS;
  const [ledger, other] = isLedger(a) ? [a, b] : [b, a];
  const lag = days(other.date, ledger.date);
  // A store can charge first and email later, but only trust that when the store and amount both match
  return lag <= BANK_LAG_DAYS && lag >= -(strong ? SAME_MOMENT_DAYS : BANK_EARLY_DAYS);
}

type Verdict = 'same' | 'maybe' | 'no' | 'blocked';

interface Comparison {
  verdict: Verdict;
  exact?: boolean;
  gap?: number;
  /** The older sighting this one takes the place of. */
  replaces?: Sighting;
}

const NO: Comparison = { verdict: 'no' };

function compareSameFeed(incoming: Sighting, known: Sighting, earlier: Set<string>): Comparison {
  const gap = Math.abs(days(incoming.date, known.date));
  if (isPendingPair(incoming, known) && gap <= BANK_LAG_DAYS && closeInSize(incoming, known)) {
    const merchant = sameMerchant(incoming.merchant, known.merchant);
    const agreement = amountsAgree(incoming, known, merchant);
    if (merchant !== 'no' && agreement) {
      return { verdict: 'same', exact: agreement === 'exact', gap, ...(incoming.pending ? {} : { replaces: known }) };
    }
  }
  // The agent can word a store differently each time it reads the same email
  const reread = incoming.source === 'receipt' && earlier.has(known.id) && gap === 0 && incoming.amountCents === known.amountCents
    && sameMerchant(incoming.merchant, known.merchant) !== 'no';
  return reread ? { verdict: 'same', exact: true, gap } : { verdict: 'blocked' };
}

function compare(incoming: Sighting, known: Sighting, earlier: Set<string>): Comparison {
  if (sameFeed(incoming, known)) return compareSameFeed(incoming, known, earlier);
  const gap = Math.abs(days(incoming.date, known.date));
  // Cheap checks first: most pairs fail here, before any name is read
  if (gap > BANK_LAG_DAYS || !closeInSize(incoming, known)) return NO;

  const merchant = sameMerchant(incoming.merchant, known.merchant);
  if (merchant === 'no') return NO;
  const agreement = amountsAgree(incoming, known, merchant);
  if (!agreement) return NO;
  const exact = agreement === 'exact';
  if (!inWindow(incoming, known, exact && merchant === 'yes')) return NO;
  if (merchant === 'yes' || (isLedger(incoming) && isLedger(known))) return { verdict: 'same', exact, gap };
  return { verdict: 'maybe', exact, gap };
}

function fit(purchase: Purchase, incoming: Sighting, earlier: Set<string>): Comparison {
  let best = NO;
  for (const known of purchase.sightings) {
    const comparison = compare(incoming, known, earlier);
    if (comparison.verdict === 'blocked') return comparison;
    if (isBetter(comparison, best)) best = comparison;
  }
  return best;
}

const VERDICT_ORDER: Record<Verdict, number> = { same: 0, maybe: 1, no: 2, blocked: 3 };

function isBetter(next: Comparison, current: Comparison): boolean {
  if (next.verdict !== current.verdict) return VERDICT_ORDER[next.verdict] < VERDICT_ORDER[current.verdict];
  if (next.exact !== current.exact) return Boolean(next.exact);
  return (next.gap ?? Infinity) < (current.gap ?? Infinity);
}

function bestHome(purchases: Purchase[], incoming: Sighting, earlier: Set<string>): { purchase: Purchase; comparison: Comparison } | null {
  let home: { purchase: Purchase; comparison: Comparison } | null = null;
  for (const purchase of purchases) {
    const comparison = fit(purchase, incoming, earlier);
    if (comparison.verdict !== 'same' && comparison.verdict !== 'maybe') continue;
    if (!home || isBetter(comparison, home.comparison)) home = { purchase, comparison };
  }
  return home;
}

function firstBy<T>(items: T[], rank: (item: T) => number): T {
  return items.reduce((best, item) => (rank(item) < rank(best) ? item : best));
}

function isLocked(purchase: Purchase, field: NonNullable<Purchase['locked']>[number]): boolean {
  return purchase.locked?.includes(field) ?? false;
}

function moneyOwners(purchase: Purchase): Sighting[] {
  const rank = Math.min(...purchase.sightings.map(moneyRank));
  return purchase.sightings.filter((sighting) => moneyRank(sighting) === rank);
}

function chosenCategory(purchase: Purchase): Pick<Purchase, 'categoryId' | 'sure'> {
  if (isLocked(purchase, 'categoryId')) return { categoryId: purchase.categoryId, sure: true };
  const sorted = purchase.sightings.filter((sighting) => sighting.categoryId);
  if (sorted.length === 0) return { categoryId: purchase.categoryId, sure: purchase.sure };
  const confident = sorted.filter((sighting) => sighting.sure !== false);
  const best = firstBy(confident.length > 0 ? confident : sorted, (sighting) => CATEGORY_ORDER[sighting.source]);
  return { categoryId: best.categoryId, sure: best.sure !== false };
}

function bestName(sighting: Sighting): string {
  return sighting.source === 'bank' ? displayName(sighting.merchant) : sighting.merchant;
}

function kindOf(owner: Sighting): MoneyKind {
  return owner.kind ?? (owner.amountCents < 0 ? 'refund' : 'spending');
}

/** Works out what the purchase says from its sightings, leaving alone whatever the user set. */
function settle(purchase: Purchase): Purchase {
  const owners = moneyOwners(purchase);
  const owner = owners[0];
  const named = firstBy(purchase.sightings, (sighting) => NAME_ORDER[sighting.source]);
  const amountCents = purchase.split ? owners.reduce((sum, sighting) => sum + sighting.amountCents, 0) : owner.amountCents;
  const earliest = purchase.sightings.map((sighting) => sighting.date).sort()[0];
  const fromAny = <K extends 'repeats' | 'renews' | 'items' | 'once'>(field: K) => purchase.sightings.find((sighting) => sighting[field])?.[field] ?? purchase[field];
  return {
    ...purchase,
    ...chosenCategory(purchase),
    date: isLocked(purchase, 'date') ? purchase.date : earliest,
    amountCents: isLocked(purchase, 'amountCents') ? purchase.amountCents : amountCents,
    currency: isLocked(purchase, 'amountCents') ? purchase.currency : owner.currency,
    merchant: isLocked(purchase, 'merchant') ? purchase.merchant : bestName(named),
    kind: kindOf(owner),
    pending: Boolean(owner.pending),
    repeats: fromAny('repeats'),
    renews: fromAny('renews'),
    items: fromAny('items'),
    once: isLocked(purchase, 'once') ? purchase.once : fromAny('once'),
  };
}

function newPurchase(sighting: Sighting): Purchase {
  return settle({
    id: sighting.id,
    date: sighting.date,
    amountCents: sighting.amountCents,
    currency: sighting.currency,
    merchant: sighting.merchant,
    kind: kindOf(sighting),
    sure: false,
    pending: false,
    sightings: [sighting],
  });
}

function hasLedger(purchase: Purchase): boolean {
  return purchase.sightings.some(isLedger);
}

/** The smallest set of two or more amounts that adds up to the total. */
function partsOf(total: number, candidates: Purchase[]): Purchase[] | null {
  const list = candidates.slice(0, MAX_SPLIT_CANDIDATES);
  let best: Purchase[] | null = null;
  for (let mask = 1; mask < 1 << list.length; mask++) {
    const parts = list.filter((_, index) => mask & (1 << index));
    if (parts.length < 2 || (best && parts.length >= best.length)) continue;
    if (parts.reduce((sum, part) => sum + part.amountCents, 0) === total) best = parts;
  }
  return best;
}

function byDate(a: Purchase, b: Purchase): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

/** Folds the parts of a split order into one purchase, so its total counts once. */
function joinSplits(purchases: Purchase[]): { purchases: Purchase[]; folded: number } {
  let list = purchases;
  let folded = 0;

  const fold = (whole: Purchase, parts: Purchase[], split: boolean) => {
    const gone = new Set(parts);
    const joined = settle({ ...whole, split, sightings: [...whole.sightings, ...parts.flatMap((part) => part.sightings)] });
    list = list.filter((purchase) => !gone.has(purchase)).map((purchase) => (purchase === whole ? joined : purchase));
    folded += parts.length;
  };

  const related = (a: Purchase, b: Purchase) => Math.sign(a.amountCents) === Math.sign(b.amountCents) && !b.removed && a.currency === b.currency && sameMerchant(a.merchant, b.merchant) === 'yes';

  // One receipt, several charges
  for (const whole of list.filter((purchase) => !hasLedger(purchase) && !purchase.removed)) {
    const charges = list
      .filter((purchase) => hasLedger(purchase) && !purchase.sightings.some((sighting) => sighting.source === 'receipt') && related(whole, purchase))
      .filter((purchase) => { const lag = days(whole.date, purchase.date); return lag >= -BANK_EARLY_DAYS && lag <= SPLIT_DAYS; })
      .sort(byDate);
    const parts = partsOf(whole.amountCents, charges);
    if (parts) fold(whole, parts, true);
  }

  // One charge, several receipts
  for (const whole of list.filter((purchase) => hasLedger(purchase) && !purchase.removed && !purchase.split)) {
    if (whole.sightings.some((sighting) => sighting.source === 'receipt')) continue;
    const receipts = list
      .filter((purchase) => !hasLedger(purchase) && related(whole, purchase))
      .filter((purchase) => { const lag = days(purchase.date, whole.date); return lag >= -BANK_EARLY_DAYS && lag <= SPLIT_DAYS; })
      .sort(byDate);
    const parts = partsOf(whole.amountCents, receipts);
    if (parts) fold(whole, parts, false);
  }

  return { purchases: list, folded };
}

function linkRefunds(purchases: Purchase[]): Purchase[] {
  return purchases.map((refund) => {
    if (refund.amountCents >= 0 || refund.kind !== 'refund' || refund.refundOf || refund.removed) return refund;
    const candidates = purchases.filter((original) => {
      if (original.amountCents <= 0 || original.removed || original.kind !== 'spending') return false;
      const age = days(original.date, refund.date);
      return age >= 0 && age <= REFUND_DAYS && original.amountCents >= -refund.amountCents && sameMerchant(original.merchant, refund.merchant) === 'yes';
    });
    if (candidates.length === 0) return refund;
    const closest = (item: Purchase) => Math.abs(item.amountCents + refund.amountCents) * REFUND_DAYS + days(item.date, refund.date);
    return { ...refund, refundOf: firstBy(candidates, closest).id };
  });
}

/** Paying a card shows on both accounts. Neither side is spending. */
function pairTransfers(purchases: Purchase[]): Purchase[] {
  const account = (purchase: Purchase) => purchase.sightings.find(isLedger)?.accountId;
  const legs = purchases.filter((purchase) => purchase.kind === 'transfer' && hasLedger(purchase));
  return purchases.map((purchase) => {
    if (purchase.kind === 'transfer' || purchase.removed || !hasLedger(purchase) || isLocked(purchase, 'categoryId')) return purchase;
    const match = legs.some((leg) => leg.amountCents === -purchase.amountCents && account(leg) !== account(purchase) && Math.abs(days(leg.date, purchase.date)) <= TRANSFER_DAYS);
    return match ? { ...purchase, kind: 'transfer' as const } : purchase;
  });
}

function arrivalOrder(a: Sighting, b: Sighting): number {
  return moneyRank(a) - moneyRank(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

/**
 * Folds sightings into purchases. The bank's rows go first so they anchor everything else, and a
 * match is used up, so two real purchases stay two. Running the same sightings twice changes nothing.
 */
export function reconcile(existing: Purchase[], incoming: Sighting[]): ReconcileResult {
  let purchases = existing.map((purchase) => ({ ...purchase, sightings: [...purchase.sightings] }));
  const earlier = new Set(purchases.flatMap((purchase) => purchase.sightings.map((sighting) => sighting.id)));
  const holderOf = (id: string) => purchases.find((purchase) => purchase.sightings.some((sighting) => sighting.id === id));
  const replaced = new Set([...purchases.flatMap((purchase) => purchase.sightings), ...incoming].flatMap((sighting) => sighting.replacesId ?? []));

  const swap = (holder: Purchase, id: string, next: Sighting) => {
    const updated = settle({ ...holder, sightings: holder.sightings.map((sighting) => (sighting.id === id ? next : sighting)) });
    purchases = purchases.map((purchase) => (purchase === holder ? updated : purchase));
  };

  const questions: SamePurchaseQuestion[] = [];
  let added = 0;
  let merged = 0;

  for (const sighting of [...incoming].sort(arrivalOrder)) {
    const holder = holderOf(sighting.id);
    if (holder) {
      swap(holder, sighting.id, sighting);
      continue;
    }
    if (replaced.has(sighting.id)) continue;

    const pending = sighting.replacesId ? holderOf(sighting.replacesId) : undefined;
    if (pending && sighting.replacesId) {
      swap(pending, sighting.replacesId, sighting);
      merged += 1;
      continue;
    }

    const home = bestHome(purchases, sighting, earlier);
    if (home?.comparison.verdict === 'same') {
      const { purchase, comparison } = home;
      if (comparison.replaces) swap(purchase, comparison.replaces.id, sighting);
      else {
        const updated = settle({ ...purchase, sightings: [...purchase.sightings, sighting] });
        purchases = purchases.map((item) => (item === purchase ? updated : item));
      }
      merged += 1;
      continue;
    }

    purchases.push(newPurchase(sighting));
    added += 1;
    if (home) questions.push({ sighting, purchaseId: home.purchase.id });
  }

  const joined = joinSplits(purchases);
  const folded = Math.min(joined.folded, added);
  const live = new Set(joined.purchases.map((purchase) => purchase.id));

  return {
    purchases: pairTransfers(linkRefunds(joined.purchases)),
    added: added - folded,
    merged: merged + joined.folded,
    questions: questions.filter((question) => live.has(question.purchaseId)),
  };
}

/** The source took these back, such as a pending charge that never posted. */
export function withdraw(purchases: Purchase[], ids: string[]): Purchase[] {
  const gone = new Set(ids);
  return purchases.flatMap((purchase) => {
    const sightings = purchase.sightings.filter((sighting) => !gone.has(sighting.id));
    if (sightings.length === purchase.sightings.length) return [purchase];
    return sightings.length > 0 ? [settle({ ...purchase, sightings })] : [];
  });
}

/** "Same purchase?" Yes folds the two together. No leaves both as they are. */
export function answerSamePurchase(purchases: Purchase[], question: SamePurchaseQuestion, same: boolean): Purchase[] {
  const own = purchases.find((purchase) => purchase.sightings.some((sighting) => sighting.id === question.sighting.id));
  const target = purchases.find((purchase) => purchase.id === question.purchaseId);
  if (!same || !own || !target || own === target) return purchases;
  const joined = settle({ ...target, sightings: [...target.sightings, ...own.sightings] });
  return purchases.filter((purchase) => purchase !== own).map((purchase) => (purchase === target ? joined : purchase));
}
