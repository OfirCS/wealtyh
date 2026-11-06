'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { tidyName } from '@/lib/agent-insights';
import { countsAsSpending, monthKey, monthLabel, ONE_TIME_ID, purchaseRhythms, shiftMonth, yearSummary } from '@/lib/budget';
import type { Budget, Rhythm, Transaction } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { categoryLabel, monthHeadline } from '@/lib/month-picture';
import type { MonthBill, MonthPicture } from '@/lib/month-picture';
import { playSound } from '@/lib/sounds';
import { holdToOpen } from '@/components/ui/ContextMenu';
import type { MenuPoint } from '@/components/ui/ContextMenu';
import { Ticking } from '@/components/ui/Ticking';
import CategoryIcon from './CategoryIcon';

export const SOURCE_NAMES = { bank: 'Bank', receipt: 'Gmail', wallet: 'Apple Pay', statement: 'Statement', typed: 'Typed' };
const MONTHS_A_YEAR = 12;
/** Rows fill in one after another, so a new import feels like being written. */
const FILL_STEP = 0.022;
const NEXT_BILLS_SHOWN = 4;

function whole(value: number): string {
  return formatMoney(Math.round(value));
}

export function exact(value: number): string {
  return value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' });
}

/** Who saw this purchase, in words. */
export function seenBy(transaction: Transaction): string[] {
  return [...new Set((transaction.sightings ?? []).map((sighting) => SOURCE_NAMES[sighting.source]))];
}

function shortDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export type MenuTarget =
  | { kind: 'category'; id: string; name: string }
  | { kind: 'bill'; name: string; merchant: string; purchaseId?: string }
  | { kind: 'purchase'; id: string };

export type OpenMenu = (point: MenuPoint, target: MenuTarget) => void;

/** The whole month in one number and a few words. */
export function MonthHero({ picture, month, today }: { picture: MonthPicture; month: string; today: string }) {
  const { amount, label, rate, over } = monthHeadline(picture, month, today);
  return (
    <div className="lg:flex lg:flex-wrap lg:items-baseline lg:gap-x-3">
      <p className="pf-amount pf-hero font-serif tracking-tight"><Ticking value={amount} format={formatMoney} /></p>
      <p className="mt-1 text-[15px] lg:mt-0 lg:text-[18px]">
        <span className={`font-bold ${over ? 'text-[var(--pf-warn)]' : ''}`}>{label}</span>
        {rate && <span className="text-[var(--pf-text-tertiary)]"> · {rate}</span>}
      </p>
    </div>
  );
}

/** A section's coloured name, and the one figure that sums it up. */
function Head({ title, tone, figure, onOpen }: { title: string; tone: 'everyday' | 'bills'; figure: React.ReactNode; onOpen?: () => void }) {
  const content = (
    <>
      <span className={`pf-tag pf-tag-${tone}`}>{title}</span>
      <span className="ml-auto whitespace-nowrap text-[15px] font-bold tabular-nums">{figure}</span>
    </>
  );
  return (
    <h2 className="mb-1">
      {onOpen
        ? <button type="button" onClick={() => { onOpen(); playSound('tap'); }} className="pf-row pf-row-head pf-row-button">{content}</button>
        : <div className="pf-row pf-row-head">{content}</div>}
    </h2>
  );
}

const NEARLY_GONE = 0.15;

/** Quiet until it matters: green as it fills, amber near the end, red past it. */
function ruleColour(share: number, over: boolean): string {
  if (over) return 'var(--pf-warn)';
  return share >= 1 - NEARLY_GONE ? 'var(--pf-tight)' : 'var(--pf-good)';
}

interface EverydayPartProps {
  picture: MonthPicture;
  fillKey: number;
  onOpenCategory: (id: string) => void;
  onMenu: OpenMenu;
}

/** Where the choices are. Each row says how much is left, and that's the whole idea. */
export function EverydayPart({ picture, fillKey, onOpenCategory, onMenu }: EverydayPartProps) {
  return (
    <section>
      <Head title="Everyday" tone="everyday" figure={<span className="text-[13px] font-medium text-[var(--pf-text-tertiary)]">left</span>} />
      <ul key={fillKey}>
        {picture.everyday.map((row, index) => {
          const over = row.left < 0;
          const share = row.planned > 0 ? Math.min(1, row.spent / row.planned) : 1;
          return (
            <motion.li key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * FILL_STEP, duration: 0.2 }}>
              <button
                type="button"
                onClick={() => { onOpenCategory(row.id); playSound('tap'); }}
                onContextMenu={(event) => onMenu(event, { kind: 'category', id: row.id, name: row.name })}
                {...holdToOpen((point) => onMenu(point, { kind: 'category', id: row.id, name: row.name }))}
                className="pf-row pf-row-button group"
              >
                <CategoryIcon id={row.id} size={20} plain />
                <span className="min-w-0 flex-1 truncate text-[18px] first-letter:uppercase">{row.name}</span>
                <span className="hidden shrink-0 text-[13px] tabular-nums text-[var(--pf-text-tertiary)] [@media(hover:hover)]:group-hover:inline">{whole(row.spent)} of {whole(row.planned)}</span>
                <span className={`shrink-0 text-[18px] font-bold tabular-nums ${over ? 'text-[var(--pf-warn)]' : ''}`}>
                  {over ? `${whole(-row.left)} over` : whole(row.left)}
                  {!over && <span className="sr-only"> left</span>}
                </span>
                <span aria-hidden className="pf-rule"><span style={{ width: `${share * 100}%`, background: ruleColour(share, over) }} /></span>
              </button>
            </motion.li>
          );
        })}
        {picture.everyday.length === 0 && <li className="py-3 text-[15px] text-[var(--pf-text-secondary)]">Nothing here yet.</li>}
      </ul>
    </section>
  );
}

/** One bill, the same row wherever it shows up. */
export function BillRow({ bill, onOpenPurchase, onMenu }: { bill: MonthBill; onOpenPurchase: (id: string) => void; onMenu: OpenMenu }) {
  const target: MenuTarget = { kind: 'bill', name: bill.name, merchant: bill.merchant, purchaseId: bill.purchaseId };
  return (
    <li>
      <button
        type="button"
        onClick={(event) => {
          // A bill that hasn't come yet has nothing to open, so a tap offers what can be done with it
          if (!bill.purchaseId) { onMenu(event, target); return; }
          onOpenPurchase(bill.purchaseId);
          playSound('tap');
        }}
        onContextMenu={(event) => onMenu(event, target)}
        {...holdToOpen((point) => onMenu(point, target))}
        className="pf-row pf-row-button"
      >
        <span aria-label={bill.paid ? 'Paid' : 'Still to come'} className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full ${bill.paid ? 'bg-[var(--pf-bills-ink)] text-[var(--pf-bills)]' : 'shadow-[inset_0_0_0_2px_var(--pf-bills)]'}`}>
          {bill.paid && <Check size={12} strokeWidth={3.25} />}
        </span>
        <span className="w-[52px] shrink-0 text-[13px] tabular-nums text-[var(--pf-text-tertiary)]">{shortDay(bill.date)}</span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{bill.name}</span>
        {bill.every !== 'monthly' && <span className="shrink-0 text-[13px] capitalize text-[var(--pf-text-tertiary)]">{bill.every}</span>}
        <span className="shrink-0 text-[15px] font-bold tabular-nums">{whole(bill.amount)}</span>
        <span aria-hidden className="pf-rule" />
      </button>
    </li>
  );
}

/** What's coming whatever you do. What's already paid waits one tap away. */
export function BillsPart({ picture, onOpenBills, onOpenPurchase, onMenu }: { picture: MonthPicture; onOpenBills: () => void; onOpenPurchase: (id: string) => void; onMenu: OpenMenu }) {
  const coming = picture.bills.filter((bill) => !bill.paid);
  const paid = picture.bills.length - coming.length;
  const unseen = Math.max(0, coming.length - NEXT_BILLS_SHOWN);
  const allPaid = picture.bills.length > 0 && coming.length === 0;
  const rest = allPaid ? `All ${paid} paid` : [paid > 0 ? `${paid} paid` : '', unseen > 0 ? `${unseen} more` : ''].filter(Boolean).join(' · ');
  return (
    <section>
      <Head title="Bills" tone="bills" figure={allPaid ? `${whole(picture.billsPaid)} paid` : `${whole(picture.billsTotal - picture.billsPaid)} to come`} onOpen={onOpenBills} />
      <ul>
        {coming.slice(0, NEXT_BILLS_SHOWN).map((bill) => <BillRow key={bill.key} bill={bill} onOpenPurchase={onOpenPurchase} onMenu={onMenu} />)}
        {picture.bills.length === 0 && <li className="py-3 text-[15px] text-[var(--pf-text-secondary)]">No regular bills yet.</li>}
      </ul>
      {rest && (
        <button type="button" onClick={() => { onOpenBills(); playSound('tap'); }} className="pf-row pf-row-button">
          <span aria-hidden className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--pf-bills-ink)] text-[var(--pf-bills)]"><Check size={12} strokeWidth={3.25} /></span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--pf-text-tertiary)]">{rest}</span>
          <ChevronRight size={15} className="shrink-0 text-[var(--pf-text-tertiary)]" aria-hidden />
        </button>
      )}
    </section>
  );
}

interface OneTimePartProps {
  picture: MonthPicture;
  onOpenPurchase: (id: string) => void;
  onOpenAll: () => void;
  onMenu: OpenMenu;
}

/** Real money spent, kept out of the budget so a flight doesn't change what next month looks like. */
export function OneTimePart({ picture, onOpenPurchase, onOpenAll, onMenu }: OneTimePartProps) {
  const only = picture.oneTime.length === 1 ? picture.oneTime[0] : null;
  return (
    <section className="mt-3 flex items-center gap-3">
      <h2 className="shrink-0"><span className="pf-tag pf-tag-once">One-time</span></h2>
      <button
        type="button"
        onClick={() => { if (only) onOpenPurchase(only.id); else onOpenAll(); playSound('tap'); }}
        onContextMenu={(event) => { if (only) onMenu(event, { kind: 'purchase', id: only.id }); }}
        {...holdToOpen((point) => { if (only) onMenu(point, { kind: 'purchase', id: only.id }); })}
        className="pf-row pf-row-button min-w-0 flex-1"
      >
        <span className="min-w-0 flex-1 truncate text-[15px]">{only ? tidyName(only.description) : `${picture.oneTime.length} purchases`}</span>
        <span className="shrink-0 text-[15px] font-bold tabular-nums">{whole(picture.oneTimeTotal)}</span>
      </button>
    </section>
  );
}

interface MonthLedgerProps extends EverydayPartProps, Omit<OneTimePartProps, 'picture' | 'onOpenAll'> {
  onOpenBills: () => void;
  onOpenOneTime: () => void;
}

/** One white page, open like a ledger: what you choose on the left, what just happens on the right. */
export function MonthLedger({ picture, fillKey, onOpenCategory, onOpenBills, onOpenOneTime, onOpenPurchase, onMenu }: MonthLedgerProps) {
  return (
    <div className="pf-card pf-ledger grid gap-y-4 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-y-0 lg:px-6 lg:pb-6 lg:pt-4">
      <div className="min-w-0 lg:border-r lg:border-[var(--pf-border)] lg:pr-6">
        <EverydayPart picture={picture} fillKey={fillKey} onOpenCategory={onOpenCategory} onMenu={onMenu} />
      </div>
      <div className="min-w-0 lg:pl-6">
        <BillsPart picture={picture} onOpenBills={onOpenBills} onOpenPurchase={onOpenPurchase} onMenu={onMenu} />
        {picture.oneTime.length > 0 && <OneTimePart picture={picture} onOpenPurchase={onOpenPurchase} onOpenAll={onOpenOneTime} onMenu={onMenu} />}
      </div>
    </div>
  );
}

/** One purchase, the same row in every list. A tag or a category, never both. */
export function PurchaseRow({ transaction, rhythm, category, onOpenPurchase, onMenu }: { transaction: Transaction; rhythm?: Rhythm; category: string; onOpenPurchase: (id: string) => void; onMenu: OpenMenu }) {
  const counted = countsAsSpending(transaction);
  const status = transaction.pending ? 'Pending' : transaction.sure ? null : 'Not sorted';
  return (
    <li>
      <button type="button" onClick={() => { onOpenPurchase(transaction.id); playSound('tap'); }} onContextMenu={(event) => onMenu(event, { kind: 'purchase', id: transaction.id })} {...holdToOpen((point) => onMenu(point, { kind: 'purchase', id: transaction.id }))} className="pf-row pf-row-button">
        <span className="w-[52px] shrink-0 text-[13px] tabular-nums text-[var(--pf-text-tertiary)]">{shortDay(transaction.date)}</span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{tidyName(transaction.description)}</span>
        {status && <span className="shrink-0 text-[13px] font-bold text-[var(--pf-warn)]">{status}</span>}
        {!status && rhythm === 'bill' && <span className="pf-tag pf-tag-small pf-tag-bills shrink-0">Bill</span>}
        {!status && rhythm === 'once' && <span className="pf-tag pf-tag-small pf-tag-once shrink-0">One-time</span>}
        {!status && rhythm === 'everyday' && <span className="hidden shrink-0 text-[13px] text-[var(--pf-text-tertiary)] sm:inline">{category}</span>}
        <span className={`w-[60px] shrink-0 text-right text-[15px] font-bold tabular-nums ${transaction.amount < 0 ? 'text-[var(--pf-good)]' : ''} ${counted ? '' : 'text-[var(--pf-text-tertiary)]'}`}>
          {transaction.amount < 0 ? `+${whole(-transaction.amount)}` : whole(transaction.amount)}
        </span>
        <span aria-hidden className="pf-rule" />
      </button>
    </li>
  );
}

interface YearLedgerProps {
  budget: Budget;
  month: string;
  onMonth: (month: string) => void;
  /** Tapping a bar goes to that month. */
  onOpenMonth: (month: string) => void;
  onOpenCategory: (id: string) => void;
  onMenu: OpenMenu;
}

/** Three months of bars say more than twelve thin ones. */
const SINGLE_LETTERS_FROM = 6;

export function YearLedger({ budget, month, onMonth, onOpenMonth, onOpenCategory, onMenu }: YearLedgerProps) {
  const year = Number(month.slice(0, 4));
  const latest = monthKey(new Date());
  const earliest = budget.transactions.reduce((first, transaction) => (transaction.date.slice(0, 7) < first ? transaction.date.slice(0, 7) : first), latest);
  const byCategory = useMemo(() => yearSummary(budget, year), [budget, year]);

  const months = Array.from({ length: MONTHS_A_YEAR }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
  const totalFor = (key: string) => Object.values(byCategory).reduce((sum, row) => sum + (row[key] ?? 0), 0);
  const shown = months.filter((key) => totalFor(key) > 0 || key === month);
  const tallest = Math.max(1, ...shown.map(totalFor));

  const rows = Object.entries(byCategory)
    .map(([id, row]) => ({
      id,
      name: categoryLabel(budget, id),
      total: Object.values(row).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const yearTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const step = (months: number) => {
    const next = shiftMonth(month, months);
    onMonth(next > latest ? latest : next);
    playSound('tap');
  };

  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="-ml-2 flex items-center gap-0.5 text-[15px] font-bold">
          <button type="button" aria-label="Previous year" disabled={shiftMonth(month, -MONTHS_A_YEAR).slice(0, 4) < earliest.slice(0, 4)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] hover:bg-[var(--pf-bg-hover)] disabled:cursor-default disabled:opacity-25" onClick={() => step(-MONTHS_A_YEAR)}><ChevronLeft size={17} /></button>
          {year}
          <button type="button" aria-label="Next year" disabled={shiftMonth(month, MONTHS_A_YEAR).slice(0, 4) > latest.slice(0, 4)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] hover:bg-[var(--pf-bg-hover)] disabled:cursor-default disabled:opacity-25" onClick={() => step(MONTHS_A_YEAR)}><ChevronRight size={17} /></button>
        </span>
        <span className="text-[15px] font-bold tabular-nums">{whole(yearTotal)} spent</span>
      </div>

      <div className="mt-2 flex h-[92px] items-end gap-1.5 sm:gap-3" role="group" aria-label={`Spending by month in ${year}`}>
        {shown.map((key) => (
          <button
            key={key}
            type="button"
            disabled={key > latest}
            aria-label={`${monthLabel(key)}: ${whole(totalFor(key))}`}
            aria-pressed={key === month}
            className="group flex h-full min-w-0 max-w-[40px] flex-1 cursor-pointer flex-col justify-end gap-1.5 disabled:cursor-default"
            onClick={() => { onOpenMonth(key); playSound('tap'); }}
          >
            <span className={`block w-full rounded-[4px] transition-colors ${key === month ? 'bg-[var(--pf-text-primary)]' : 'bg-[var(--pf-bg-dark)] group-hover:bg-[var(--pf-text-tertiary)]'}`} style={{ height: `${Math.max(3, (totalFor(key) / tallest) * 64)}px` }} />
            <span className={`text-center text-[13px] leading-none ${key === month ? 'font-bold' : 'text-[var(--pf-text-tertiary)]'}`}>{monthLabel(key).slice(0, shown.length > SINGLE_LETTERS_FROM ? 1 : 3)}</span>
          </button>
        ))}
      </div>

      <ul className="mt-3">
        {rows.map((row) => {
          const content = (
            <>
              <CategoryIcon id={row.id} size={20} plain />
              <span className="min-w-0 flex-1 truncate text-[15px] first-letter:uppercase">{row.name}</span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums">{whole(row.total)}</span>
              <span aria-hidden className="pf-rule" />
            </>
          );
          return (
            <li key={row.id}>
              {row.id === ONE_TIME_ID
                ? <div className="pf-row pf-row-button cursor-default hover:bg-transparent">{content}</div>
                : <button type="button" className="pf-row pf-row-button" onClick={() => { onOpenCategory(row.id); playSound('tap'); }} onContextMenu={(event) => onMenu(event, { kind: 'category', id: row.id, name: row.name })} {...holdToOpen((point) => onMenu(point, { kind: 'category', id: row.id, name: row.name }))}>{content}</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface PurchaseLedgerProps {
  budget: Budget;
  month: string;
  /** The month control, shared with the other views. */
  picker: React.ReactNode;
  total: number;
  /** Shown beside the list when asked for. */
  chart: React.ReactNode;
  onOpenPurchase: (id: string) => void;
  onMenu: OpenMenu;
}

export function PurchaseLedger({ budget, month, picker, total, chart, onOpenPurchase, onMenu }: PurchaseLedgerProps) {
  const [query, setQuery] = useState('');
  const [showChart, setShowChart] = useState(false);
  const search = query.trim().toLowerCase();

  // Searching looks through everything, so nobody has to remember which month it was
  const rows = useMemo(() => budget.transactions
    .filter((transaction) => (search
      ? `${transaction.description} ${categoryLabel(budget, transaction.categoryId)}`.toLowerCase().includes(search)
      : transaction.date.startsWith(month)))
    .sort((a, b) => b.date.localeCompare(a.date)), [budget, month, search]);
  const rhythms = useMemo(() => purchaseRhythms(budget), [budget]);

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {picker}
        <label className="order-last flex h-10 w-full items-center gap-2 rounded-[10px] bg-[var(--pf-bg-primary)] px-3 focus-within:shadow-[inset_0_0_0_1px_var(--pf-text-primary)] sm:order-none sm:mr-auto sm:w-[280px]">
          <Search size={15} className="shrink-0 text-[var(--pf-text-tertiary)]" aria-hidden />
          <span className="sr-only">Find a purchase</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a purchase" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--pf-text-tertiary)]" />
        </label>
        <button type="button" aria-expanded={showChart} onClick={() => { setShowChart(!showChart); playSound('tap'); }} className="flex h-8 cursor-pointer items-center gap-0.5 text-[15px] font-bold tabular-nums">
          {whole(total)} spent
          <ChevronRight size={15} className={`text-[var(--pf-text-tertiary)] transition-transform ${showChart ? 'rotate-90' : ''}`} aria-hidden />
        </button>
      </div>

      {showChart && <div className="mt-2 h-[120px]">{chart}</div>}

      <ul className="mt-1">
        {rows.map((transaction) => <PurchaseRow key={transaction.id} transaction={transaction} rhythm={rhythms.get(transaction.id)} category={categoryLabel(budget, transaction.categoryId)} onOpenPurchase={onOpenPurchase} onMenu={onMenu} />)}
      </ul>
      {rows.length === 0 && <p className="py-3 text-[15px] text-[var(--pf-text-secondary)]">{search ? 'Nothing by that name.' : `Nothing in ${monthLabel(month)}.`}</p>}
    </div>
  );
}
