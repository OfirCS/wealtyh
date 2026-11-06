'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ExternalLink, FolderInput, Pencil, Pin, Plus, Receipt, RotateCcw, Settings2, Ticket, Trash2 } from 'lucide-react';
import {
  dailySpending,
  daysInMonth,
  deleteTransaction,
  merchantKey,
  monthIncome,
  monthKey,
  monthLabel,
  nextUnsure,
  profileWithBudget,
  purchaseRhythms,
  removeCategory,
  renameCategory,
  setMerchantRhythm,
  setPlanned,
  shiftMonth,
  autoBudget,
  sortMerchant,
  SORTABLE_CATEGORIES,
  suggestBudgets,
  togglePinned,
  totalPlanned,
  typicalSpending,
  TRANSFER_ID,
  updateTransaction,
} from '@/lib/budget';
import type { Budget, Rhythm, TransactionChange, TransactionSource } from '@/lib/budget';
import { answerQuestion } from '@/lib/ledger-adapter';
import { tidyName } from '@/lib/agent-insights';
import { formatMoney } from '@/lib/money';
import { categoryLabel, everydayName, monthPicture } from '@/lib/month-picture';
import { playSound } from '@/lib/sounds';
import { localDay } from '@/lib/streak';
import type { FinancialProfile } from '@/lib/types';
import type { View } from '@/components/app/AppShell';
import type { AgentStep } from '@/components/ui/AgentSteps';
import ContextMenu, { useContextMenu } from '@/components/ui/ContextMenu';
import type { MenuEntry } from '@/components/ui/ContextMenu';
import Sheet from '@/components/ui/Sheet';
import CategoryIcon from './CategoryIcon';
import CategorySheet from './CategorySheet';
import BillsSheet from './BillsSheet';
import { MonthHero, MonthLedger, PurchaseLedger, PurchaseRow, YearLedger } from './Ledger';
import type { MenuTarget } from './Ledger';
import SpendChart from './SpendChart';
import TransactionEditor from './TransactionEditor';

/** What the cards beside the budget can do to it. */
export interface BudgetActions {
  openPurchase: (id: string) => void;
  openCategory: (id: string) => void;
  openBills: () => void;
  review: () => void;
  setBudgetFor: (categoryId: string, amount: number) => void;
}

function SettingRow({ label, onChoose }: { label: string; onChoose: () => void }) {
  return (
    <li>
      <button type="button" onClick={onChoose} className="pf-row-button flex h-11 items-center justify-between gap-3 text-[15px]">
        <span className="min-w-0 truncate">{label}</span>
        <ChevronRight size={16} className="shrink-0 text-[var(--pf-text-tertiary)]" aria-hidden />
      </button>
    </li>
  );
}

interface BudgetViewProps {
  budget: Budget;
  greeting: string;
  /** The streak, points and the week's goal. */
  game: (actions: BudgetActions) => React.ReactNode;
  /** What the agent found today. */
  today: (actions: BudgetActions, isSample: boolean) => React.ReactNode;
  isSample: boolean;
  view: View;
  onView: (view: View) => void;
  fillKey: number;
  month: string;
  profile: FinancialProfile;
  hasNumbers: boolean;
  problem: string | null;
  steps: AgentStep[] | null;
  canUndo: boolean;
  /** A purchase to open as soon as the sheet appears. */
  openOnArrival?: string | null;
  /** Start by asking about the charges the agent couldn't sort. */
  reviewOnArrival?: boolean;
  onUndo: () => void;
  onMonthChange: (month: string) => void;
  onChange: (budget: Budget) => void;
  onAddFile: (file: File, source?: TransactionSource) => void;
  onFromNumbers?: () => void;
  onUpdateProfile: (profile: FinancialProfile) => void;
  onStartOver: () => void;
  onConnect: () => void;
}

function downloadSpreadsheet(budget: Budget) {
  const rows = [
    ['Date', 'Name', 'Category', 'Amount'],
    ...budget.transactions.map((transaction) => [transaction.date, tidyName(transaction.description), categoryLabel(budget, transaction.categoryId), transaction.amount.toFixed(2)]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'pathfinder-budget.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

interface MonthPickerProps {
  month: string;
  earliest: string;
  latest: string;
  onMonth: (month: string) => void;
}

/** The year only shows when it isn't this one. */
function MonthPicker({ month, earliest, latest, onMonth }: MonthPickerProps) {
  const label = month.slice(0, 4) === latest.slice(0, 4) ? monthLabel(month).split(' ')[0] : monthLabel(month);
  const step = (months: number) => { onMonth(shiftMonth(month, months)); playSound('tap'); };
  return (
    <span className="-ml-2 flex items-center gap-0.5 text-[15px] font-bold">
      <button type="button" aria-label="Previous month" disabled={month <= earliest} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] hover:bg-[var(--pf-bg-hover)] disabled:cursor-default disabled:opacity-25" onClick={() => step(-1)}><ChevronLeft size={17} /></button>
      {label}
      <button type="button" aria-label="Next month" disabled={month >= latest} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] hover:bg-[var(--pf-bg-hover)] disabled:cursor-default disabled:opacity-25" onClick={() => step(1)}><ChevronRight size={17} /></button>
    </span>
  );
}

/** Long enough to read, short enough not to linger. */
const STATUS_MS = 5000;

export default function BudgetView({
  budget,
  greeting,
  game,
  today: todayCard,
  isSample,
  view,
  onView,
  fillKey,
  month,
  profile,
  hasNumbers,
  problem,
  steps,
  canUndo,
  openOnArrival,
  reviewOnArrival,
  onUndo,
  onMonthChange,
  onChange,
  onAddFile,
  onFromNumbers,
  onUpdateProfile,
  onStartOver,
  onConnect,
}: BudgetViewProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(openOnArrival ?? null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBills, setShowBills] = useState(false);
  const [showOneTime, setShowOneTime] = useState(false);
  const [reviewing, setReviewing] = useState(!!reviewOnArrival);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [dragging, setDragging] = useState(false);

  const [today] = useState(() => new Date());
  const [todayIso] = useState(() => localDay());
  const picture = useMemo(() => monthPicture(budget, month, todayIso), [budget, month, todayIso]);
  const rhythms = useMemo(() => purchaseRhythms(budget), [budget]);
  const unsure = useMemo(() => nextUnsure(budget), [budget]);
  const sameQuestion = budget.questions?.[0];
  const sameTarget = sameQuestion && budget.transactions.find((transaction) => transaction.id === sameQuestion.purchaseId);

  const latestMonth = monthKey(today);
  const earliestMonth = budget.transactions[0]?.date.slice(0, 7) ?? latestMonth;
  const received = monthIncome(budget, month);
  const categoryOptions = [
    ...SORTABLE_CATEGORIES,
    ...budget.categories.filter((category) => !SORTABLE_CATEGORIES.some((item) => item.id === category.id) && category.id !== 'other'),
  ].map((option) => ({ ...option, name: everydayName(option.id, categoryLabel(budget, option.id)) }));

  const nameOf = useCallback((id: string) => categoryLabel(budget, id), [budget]);

  const done = useCallback((next: Budget, message: string) => {
    onChange(next);
    setStatus(message);
    playSound('pop');
  }, [onChange]);

  const editBudget = useCallback((id: string, value: number) => {
    done(setPlanned(budget, id, value), `${nameOf(id)} budget is now ${formatMoney(value)}`);
  }, [budget, done, nameOf]);

  const setRhythm = useCallback((description: string, rhythm: Rhythm, message: string) => {
    done(autoBudget(setMerchantRhythm(budget, description, rhythm)), message);
  }, [budget, done]);

  const removePurchase = useCallback((id: string) => {
    const transaction = budget.transactions.find((item) => item.id === id);
    done(deleteTransaction(budget, id), `Deleted ${transaction ? tidyName(transaction.description) : 'that purchase'}`);
    setEditingId(null);
  }, [budget, done]);

  const savePurchase = (id: string, change: TransactionChange, everyTime: boolean) => {
    const transaction = budget.transactions.find((item) => item.id === id);
    if (!transaction) return;
    let next = updateTransaction(budget, id, change);
    if (everyTime && change.categoryId && change.categoryId !== transaction.categoryId) next = sortMerchant(next, transaction.description, change.categoryId);
    if (everyTime && change.once !== undefined) next = setMerchantRhythm(next, transaction.description, change.once ? 'once' : 'everyday');
    done(change.once === undefined ? next : autoBudget(next), change.once === undefined ? 'Saved' : change.once ? 'Kept out of your budget' : 'Back in your budget');
    setEditingId(null);
  };

  const setBudgetsForMe = useCallback(() => {
    done(suggestBudgets(budget), 'Done. Your budgets now match what you really spend.');
  }, [budget, done]);

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-');
    if (!budget.categories.some((category) => category.id === id)) {
      done({ ...budget, planEdited: true, categories: [...budget.categories, { id, name, planned: 0 }] }, `Added ${name}`);
    }
    setNewCategory('');
    // A new category has no budget yet, so go straight to where one can be typed
    setShowSettings(false);
    setOpenCategory(id);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if ((event.target as HTMLElement).closest('input, textarea')) return;
      event.preventDefault();
      if (canUndo) {
        onUndo();
        setStatus('Undone');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, onUndo]);

  // A message from the agent gets the same few seconds as any other
  const [lastProblem, setLastProblem] = useState(problem);
  const [problemShown, setProblemShown] = useState(false);
  if (problem !== lastProblem) {
    setLastProblem(problem);
    setProblemShown(false);
  }
  const showProblem = !!problem && !problemShown;
  const message = showProblem ? problem : status;

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setStatus(null);
      setProblemShown(true);
    }, STATUS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  // Moving the last one-time purchase back empties its list, and an undo shouldn't reopen it
  if (showOneTime && picture.oneTime.length === 0) setShowOneTime(false);


  const { target: menu, open: openMenu, close: closeMenu } = useContextMenu<MenuTarget>();

  /** Right-click anything: it offers what can be changed about that one thing. */
  const menuEntries = (item: MenuTarget): MenuEntry[] => {
    if (item.kind === 'category') {
      const pinned = budget.pinned?.includes(item.id) ?? false;
      return [
        { kind: 'heading', label: item.name },
        { kind: 'action', label: 'Change budget or name', icon: Pencil, onSelect: () => setOpenCategory(item.id) },
        { kind: 'action', label: pinned ? 'Unpin' : 'Pin to top', icon: Pin, onSelect: () => done(togglePinned(budget, item.id), pinned ? `Unpinned ${item.name}` : `${item.name} stays on top`) },
        { kind: 'action', label: 'Add a category', icon: Plus, onSelect: () => setShowSettings(true) },
        // Other is where everything else goes, so it can't be taken away
        ...(item.id === 'other' ? [] : [
          { kind: 'divider' as const },
          { kind: 'action' as const, label: 'Remove from budget', icon: Trash2, danger: true, onSelect: () => done(removeCategory(budget, item.id), `Removed ${item.name}`) },
        ]),
      ];
    }
    if (item.kind === 'bill') {
      return [
        { kind: 'heading', label: item.name },
        ...(item.purchaseId ? [{ kind: 'action' as const, label: 'Open', icon: ExternalLink, onSelect: () => setEditingId(item.purchaseId ?? null) }] : []),
        { kind: 'action', label: 'Not a bill', icon: Receipt, onSelect: () => setRhythm(item.merchant, 'everyday', `${item.name} is everyday spending now`) },
        { kind: 'action', label: 'One-time', icon: Ticket, onSelect: () => setRhythm(item.merchant, 'once', 'Kept out of your budget') },
      ];
    }
    const purchase = budget.transactions.find((transaction) => transaction.id === item.id);
    if (!purchase) return [];
    const once = rhythms.get(purchase.id) === 'once';
    return [
      { kind: 'heading', label: tidyName(purchase.description) },
      { kind: 'action', label: 'Edit', icon: Pencil, onSelect: () => setEditingId(purchase.id) },
      {
        kind: 'submenu',
        label: 'Move to',
        icon: FolderInput,
        value: nameOf(purchase.categoryId),
        items: categoryOptions.map((option) => ({ kind: 'action' as const, label: option.name, checked: option.id === purchase.categoryId, onSelect: () => done(updateTransaction(budget, purchase.id, { categoryId: option.id }), `Moved to ${option.name}`) })),
      },
      { kind: 'action', label: once ? 'Put back in budget' : 'One-time', icon: Ticket, onSelect: () => done(autoBudget(updateTransaction(budget, purchase.id, { once: !once })), once ? 'Back in your budget' : 'Kept out of your budget') },
      { kind: 'action', label: 'Always a bill', icon: Receipt, onSelect: () => setRhythm(purchase.description, 'bill', `${tidyName(purchase.description)} is a bill now`) },
      { kind: 'divider' },
      { kind: 'action', label: 'Delete', icon: Trash2, danger: true, onSelect: () => removePurchase(purchase.id) },
    ];
  };

  const actions: BudgetActions = {
    openPurchase: setEditingId,
    openCategory: setOpenCategory,
    openBills: () => setShowBills(true),
    review: () => setReviewing(true),
    setBudgetFor: editBudget,
  };

  const editing = editingId ? budget.transactions.find((transaction) => transaction.id === editingId) : undefined;
  const opened = openCategory ? budget.categories.find((category) => category.id === openCategory) : undefined;
  const openedRow = opened && picture.everyday.find((row) => row.id === opened.id);

  return (
    <div
      className="relative mx-auto w-full max-w-[640px] lg:max-w-none"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onAddFile(file);
      }}
    >
      <h1 className="sr-only">{greeting}</h1>

      {view === 'month' && (
        <div className="flex flex-col">
          <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-8">
            <div className="order-1 lg:order-none">
              <div className="flex items-center justify-between lg:justify-start lg:gap-2">
                <MonthPicker month={month} earliest={earliestMonth} latest={latestMonth} onMonth={onMonthChange} />
                <button type="button" aria-label="Settings" className="-mr-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-[var(--pf-text-secondary)] hover:bg-[var(--pf-bg-hover)] lg:mr-0" onClick={() => { setShowSettings(true); playSound('tap'); }}><Settings2 size={18} /></button>
              </div>
              <MonthHero picture={picture} month={month} today={todayIso} />
            </div>
            <div className="order-3 mt-2 lg:order-none lg:mt-0">{game(actions)}</div>
          </div>
          <div className="order-2 mt-2 lg:order-none">{todayCard(actions, isSample)}</div>
          <div className="relative order-4 mt-3 lg:order-none lg:mt-2">
            <MonthLedger picture={picture} fillKey={fillKey} onOpenCategory={setOpenCategory} onOpenBills={() => setShowBills(true)} onOpenOneTime={() => setShowOneTime(true)} onOpenPurchase={setEditingId} onMenu={openMenu} />
            {budget.transactions.length === 0 && !isSample && !steps && (
              <div className="absolute left-1/2 top-16 z-10 w-[min(92%,420px)] -translate-x-1/2 rounded-[16px] bg-[var(--pf-bg-surface)] p-6 text-center shadow-[inset_0_0_0_1px_var(--pf-border),0_12px_32px_rgba(28,27,27,0.1)]">
                <p className="pf-title">Nothing here yet</p>
                <button type="button" className="pf-btn pf-btn-agent mt-4 h-11" onClick={onConnect}>Bring in my receipts</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'year' && (
        <div className="pf-card px-4 pb-3 pt-2 lg:px-6"><YearLedger budget={budget} month={month} onMonth={onMonthChange} onOpenMonth={(key) => { onMonthChange(key); onView('month'); }} onOpenCategory={setOpenCategory} onMenu={openMenu} /></div>
      )}

      {view === 'transactions' && (
        <div className="pf-card px-4 pb-3 pt-2 lg:px-6">
          <PurchaseLedger
            budget={budget}
            month={month}
            picker={<MonthPicker month={month} earliest={earliestMonth} latest={latestMonth} onMonth={onMonthChange} />}
            total={picture.spent + picture.oneTimeTotal}
            chart={<SpendChart points={dailySpending(budget, month, month === latestMonth ? today.getDate() : daysInMonth(month))} days={daysInMonth(month)} planned={picture.planned} month={month} />}
            onOpenPurchase={setEditingId}
            onMenu={openMenu}
          />
        </div>
      )}

      {dragging && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[16px] border-2 border-dashed border-[var(--pf-text-primary)] bg-[var(--pf-bg-primary)]/90">
          <p className="pf-title">Drop it. I&rsquo;ll add it to your budget.</p>
        </div>
      )}

      <ContextMenu at={menu} items={menu ? menuEntries(menu) : []} onClose={closeMenu} />

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(74px+var(--pf-badge-room,0px))] z-[60] flex justify-center px-4 lg:bottom-[calc(24px+var(--pf-badge-room,0px))]">
        <AnimatePresence>
          {message && (
            <motion.p role="status" className="pointer-events-auto flex min-h-11 items-center gap-3 rounded-[16px] bg-[var(--pf-ink)] px-4 py-2 text-[15px] leading-snug text-[var(--pf-ivory)] shadow-[0_12px_32px_rgba(28,27,27,0.24)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}>
              <span className="min-w-0">{message}</span>
              {!showProblem && canUndo && <button type="button" onClick={() => { onUndo(); setStatus('Undone'); playSound('tap'); }} className="shrink-0 cursor-pointer font-bold text-[var(--pf-agent)]">Undo</button>}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showBills && !editing && <BillsSheet budget={budget} picture={picture} month={month} today={todayIso} onOpenPurchase={setEditingId} onMenu={openMenu} onClose={() => setShowBills(false)} />}

        {showOneTime && !editing && (
          <Sheet title="One-time" onClose={() => setShowOneTime(false)}>
            <p className="mb-1 text-[15px] text-[var(--pf-text-secondary)]">Counted as spent. Left out of your budget.</p>
            <ul>
              {picture.oneTime.map((transaction) => <PurchaseRow key={transaction.id} transaction={transaction} rhythm="once" category={nameOf(transaction.categoryId)} onOpenPurchase={setEditingId} onMenu={openMenu} />)}
            </ul>
          </Sheet>
        )}

        {opened && !editing && (
          <CategorySheet
            key={`${opened.id}-${month}`}
            category={{ ...opened, name: everydayName(opened.id, opened.name) }}
            month={month}
            left={openedRow?.left}
            spent={openedRow?.spent}
            usual={typicalSpending(budget)[opened.id]}
            forBills={opened.planned - (openedRow?.planned ?? opened.planned)}
            rhythms={rhythms}
            transactions={budget.transactions.filter((transaction) => transaction.categoryId === opened.id && transaction.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date))}
            onRename={(name) => done(renameCategory(budget, opened.id, name), `Renamed to ${name}`)}
            onBudget={(value) => editBudget(opened.id, value)}
            onOpenPurchase={setEditingId}
            onMenu={openMenu}
            onClose={() => setOpenCategory(null)}
          />
        )}

        {editing && (
          <TransactionEditor
            key={editing.id}
            transaction={editing}
            oneTime={rhythms.get(editing.id) === 'once'}
            categories={categoryOptions}
            sameMerchant={budget.transactions.filter((item) => item.id !== editing.id && merchantKey(item.description) === merchantKey(editing.description)).length}
            onSave={(change, everyTime) => savePurchase(editing.id, change, everyTime)}
            onDelete={() => removePurchase(editing.id)}
            onClose={() => setEditingId(null)}
          />
        )}

        {reviewing && (
          <Sheet title="Quick question" onClose={() => setReviewing(false)}>
            {sameQuestion && sameTarget ? (
              <div>
                <p className="pf-title">Same purchase?</p>
                <p className="mt-3 text-[15px]">{tidyName(sameTarget.description)} · {formatMoney(sameTarget.amount)}</p>
                <p className="text-[15px]">{tidyName(sameQuestion.sighting.merchant)} · {formatMoney(sameQuestion.sighting.amountCents / 100)}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" className="pf-btn pf-btn-primary h-11" onClick={() => { onChange(answerQuestion(budget, sameQuestion, true)); playSound('success'); }}>Yes</button>
                  <button type="button" className="pf-btn pf-btn-secondary h-11" onClick={() => { onChange(answerQuestion(budget, sameQuestion, false)); playSound('tap'); }}>No</button>
                </div>
              </div>
            ) : unsure ? (
              <div>
                <p className="pf-title">{tidyName(unsure.transaction.description)}</p>
                <p className="mt-1 text-[15px] text-[var(--pf-text-secondary)]">
                  {formatMoney(unsure.transaction.amount)}
                  {unsure.sameMerchant > 1 ? `, and ${unsure.sameMerchant - 1} more like it` : ''}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {categoryOptions.map((option) => (
                    <button key={option.id} type="button" className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-[12px] bg-[var(--pf-bg-primary)] px-2 text-left text-[15px] hover:bg-[var(--pf-bg-elevated)]" onClick={() => { onChange(autoBudget(sortMerchant(budget, unsure.transaction.description, option.id))); playSound('success'); }}>
                      <CategoryIcon id={option.id} size={26} /><span className="truncate">{option.name}</span>
                    </button>
                  ))}
                  <button type="button" className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-[12px] bg-[var(--pf-bg-primary)] px-2 text-left text-[15px] hover:bg-[var(--pf-bg-elevated)]" onClick={() => { onChange(autoBudget(sortMerchant(budget, unsure.transaction.description, TRANSFER_ID))); playSound('success'); }}>
                    <CategoryIcon id={TRANSFER_ID} size={26} /><span className="truncate">Not spending</span>
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[15px] text-[var(--pf-text-tertiary)]">{unsure.remaining} left</p>
                  <button type="button" className="pf-link shrink-0 text-[15px]" onClick={() => { onChange(autoBudget(sortMerchant(budget, unsure.transaction.description, 'other'))); playSound('tap'); }}>Skip</button>
                </div>
              </div>
            ) : (
              <p className="text-[18px]">All sorted. Thanks.</p>
            )}
          </Sheet>
        )}

        {showSettings && (
          <Sheet title="Settings" onClose={() => { setShowSettings(false); setConfirmingReset(false); }}>
            <dl>
              <div className="flex h-11 items-center justify-between gap-3 text-[15px]">
                <dt>Money in</dt>
                <dd className="font-bold tabular-nums">{formatMoney(received > 0 ? received : budget.income)}</dd>
              </div>
              <div className="flex h-11 items-center justify-between gap-3 text-[15px]">
                <dt>Budgeted</dt>
                <dd className="font-bold tabular-nums">{formatMoney(totalPlanned(budget))}</dd>
              </div>
              <div className="flex h-11 items-center justify-between gap-3 border-b border-[var(--pf-border)] text-[15px]">
                <dt>For everyday</dt>
                <dd className="font-bold tabular-nums">{formatMoney(picture.everydayPlanned)}</dd>
              </div>
            </dl>

            <ul className="mt-1">
              {isSample && onFromNumbers && <SettingRow label="Start from my Pathfinder numbers" onChoose={() => { setShowSettings(false); onFromNumbers(); playSound('success'); }} />}
              {hasNumbers && !isSample && (
                <SettingRow
                  label="Use in my plans"
                  onChoose={() => {
                    onUpdateProfile(profileWithBudget(profile, budget));
                    setStatus('Your plans now use this budget');
                    setShowSettings(false);
                    playSound('success');
                  }}
                />
              )}
              <SettingRow label="Match budgets to my spending" onChoose={() => { setBudgetsForMe(); setShowSettings(false); }} />
              <SettingRow label="Download spreadsheet" onChoose={() => downloadSpreadsheet(budget)} />
              {canUndo && <SettingRow label="Undo last change" onChoose={() => { onUndo(); setStatus('Undone'); setShowSettings(false); playSound('tap'); }} />}
            </ul>

            <div className="mt-2 flex w-full items-center gap-2">
              <label htmlFor="pf-new-category" className="sr-only">New category</label>
              <input
                id="pf-new-category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') addCategory(); }}
                placeholder="Add a category"
                className="h-11 min-w-0 flex-1 rounded-[10px] bg-[var(--pf-bg-primary)] px-3 text-[15px] outline-none placeholder:text-[var(--pf-text-tertiary)] focus:shadow-[inset_0_0_0_2px_var(--pf-text-primary)]"
              />
              <button type="button" className="pf-btn pf-btn-secondary h-11 rounded-[10px] px-4" onClick={addCategory}>Add</button>
            </div>

            {!isSample && (confirmingReset ? (
              <p className="mt-3 flex items-center gap-4 text-[15px]">
                Delete this budget?
                <button type="button" className="cursor-pointer font-bold text-[var(--pf-warn)]" onClick={() => { onStartOver(); setShowSettings(false); setConfirmingReset(false); }}>Yes, delete it</button>
                <button type="button" className="pf-link" onClick={() => setConfirmingReset(false)}>Keep it</button>
              </p>
            ) : (
              <button type="button" className="mt-3 flex cursor-pointer items-center gap-1.5 text-[15px] text-[var(--pf-warn)]" onClick={() => setConfirmingReset(true)}><RotateCcw size={14} aria-hidden /> Start over</button>
            ))}
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
