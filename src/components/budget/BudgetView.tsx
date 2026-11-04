'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  addQuickEntry,
  categoryName,
  INCOME_ID,
  monthIncome,
  monthKey,
  monthLabel,
  monthSummary,
  nextUnsure,
  parseQuickEntry,
  profileWithBudget,
  shiftMonth,
  sortMerchant,
  SORTABLE_CATEGORIES,
  SOURCE_LABELS,
  totalPlanned,
  TRANSFER_ID,
  yearSummary,
} from '@/lib/budget';
import type { Budget, ImportSummary, TransactionSource } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { playSound } from '@/lib/sounds';
import { useElementSize } from '@/lib/use-element-height';
import { useMediaQuery } from '@/lib/use-media';
import type { FinancialProfile } from '@/lib/types';
import AgentSteps from '@/components/ui/AgentSteps';
import type { AgentStep } from '@/components/ui/AgentSteps';
import Sheet from '@/components/ui/Sheet';
import { Ticking } from '@/components/ui/Ticking';
import CanvasCard from './CanvasCard';
import type { CardLayout } from './CanvasCard';
import ConnectList from './ConnectList';
import SheetGrid, { ITEM_DRAG_TYPE } from './SheetGrid';
import type { SheetColumn, SheetRow } from './SheetGrid';

interface BudgetViewProps {
  budget: Budget;
  isSample: boolean;
  report: ImportSummary | null;
  fillKey: number;
  month: string;
  profile: FinancialProfile;
  hasNumbers: boolean;
  problem: string | null;
  steps: AgentStep[] | null;
  onMonthChange: (month: string) => void;
  onChange: (budget: Budget) => void;
  onAddFile: (file: File, source?: TransactionSource) => void;
  onAddText: (text: string) => void;
  onFromNumbers?: () => void;
  onUpdateProfile: (profile: FinancialProfile) => void;
  onStartOver: () => void;
}

type Tab = 'month' | 'year' | 'transactions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'Whole year' },
  { id: 'transactions', label: 'Transactions' },
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type CardId = 'summary' | 'connect' | 'month' | 'year' | 'transactions';

const DEFAULT_LAYOUT: Record<CardId, CardLayout> = {
  summary: { x: 0, y: 0, w: 0.235, h: 0.25 },
  connect: { x: 0, y: 0.27, w: 0.235, h: 0.4 },
  transactions: { x: 0, y: 0.69, w: 0.235, h: 0.31 },
  month: { x: 0.25, y: 0, w: 0.355, h: 1 },
  year: { x: 0.62, y: 0, w: 0.38, h: 1 },
};

const LAYOUT_KEY = 'pathfinder.canvas.v3';

function loadLayout(): Record<CardId, CardLayout> {
  try {
    const saved = window.localStorage.getItem(LAYOUT_KEY);
    return saved ? { ...DEFAULT_LAYOUT, ...(JSON.parse(saved) as Partial<Record<CardId, CardLayout>>) } : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: Record<CardId, CardLayout>) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}

const CATEGORY_COLUMN = 124;
const NUMBER_COLUMN = 76;
const GUTTER = 34;

function plain(value: number): string {
  if (Math.round(value) === 0) return '–';
  return `${value < 0 ? '−' : ''}${Math.round(Math.abs(value)).toLocaleString('en-CA')}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default function BudgetView({
  budget,
  isSample,
  report,
  fillKey,
  month,
  profile,
  hasNumbers,
  problem,
  steps,
  onMonthChange,
  onChange,
  onAddFile,
  onAddText,
  onFromNumbers,
  onUpdateProfile,
  onStartOver,
}: BudgetViewProps) {
  const [tab, setTab] = useState<Tab>('month');
  const [entry, setEntry] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [dragging, setDragging] = useState(false);
  const [canvasRef, canvas] = useElementSize<HTMLDivElement>();
  const [layout, setLayout] = useState<Record<CardId, CardLayout>>(loadLayout);
  const [order, setOrder] = useState<CardId[]>(['summary', 'connect', 'transactions', 'month', 'year']);
  const useCanvas = useMediaQuery('(min-width: 1024px)');
  const fileInput = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => monthSummary(budget, month), [budget, month]);
  const unsure = useMemo(() => nextUnsure(budget), [budget]);
  const year = Number(month.slice(0, 4));
  const yearData = useMemo(() => yearSummary(budget, year), [budget, year]);

  const walletLink = `${window.location.origin}${window.location.pathname}?spent=AMOUNT&at=MERCHANT`;
  const today = new Date();
  const latestMonth = monthKey(today);
  const earliestMonth = budget.transactions[0]?.date.slice(0, 7) ?? latestMonth;
  const ordered = [...budget.categories].sort((a, b) => b.planned - a.planned);
  const received = monthIncome(budget, month);

  const openName = openCategory ? budget.categories.find((category) => category.id === openCategory)?.name ?? categoryName(openCategory) : '';
  const categoryOptions = [
    ...SORTABLE_CATEGORIES,
    ...budget.categories.filter((category) => !SORTABLE_CATEGORIES.some((item) => item.id === category.id) && category.id !== 'other'),
  ];

  const setPlanned = (id: string, value: number) => {
    onChange({ ...budget, categories: budget.categories.map((category) => (category.id === id ? { ...category, planned: value } : category)) });
    setStatus(`✓ ${categoryName(id)} budget is now ${formatMoney(value)}`);
    playSound('pop');
  };

  const addEntry = () => {
    const parsed = parseQuickEntry(entry);
    if (!parsed) {
      setStatus('Try something like: 45 costco');
      return;
    }
    const date = month === latestMonth ? today.toISOString().slice(0, 10) : `${month}-15`;
    const { budget: next, categoryId } = addQuickEntry(budget, parsed, date);
    onChange(next);
    setEntry('');
    setStatus(`✓ ${formatMoney(parsed.amount)} added to ${categoryName(categoryId)}`);
    playSound('pop');
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!budget.categories.some((category) => category.id === id)) {
      onChange({ ...budget, categories: [...budget.categories, { id, name, planned: 0 }] });
      setStatus(`✓ Added ${name}`);
      playSound('pop');
    }
    setNewCategory('');
  };

  // ── This month sheet ──
  const monthColumns: SheetColumn[] = [
    { key: 'name', label: 'Category' },
    { key: 'budget', label: 'Budget', align: 'right', width: NUMBER_COLUMN },
    { key: 'spent', label: 'Spent', align: 'right', width: NUMBER_COLUMN },
    { key: 'left', label: 'Left', align: 'right', width: NUMBER_COLUMN },
  ];
  const monthRows: SheetRow[] = ordered.map((category) => {
    const spent = summary.spentByCategory[category.id] ?? 0;
    return {
      id: category.id,
      onOpen: () => setOpenCategory(category.id),
      cells: {
        name: { text: category.name },
        budget: { text: plain(category.planned), value: category.planned },
        spent: { text: plain(spent) },
        left: { text: plain(category.planned - spent), strong: spent > category.planned },
      },
    };
  });
  const monthTotal: SheetRow = {
    id: 'total',
    cells: {
      name: { text: 'Total', strong: true },
      budget: { text: plain(summary.planned), strong: true },
      spent: { text: plain(summary.spent), strong: true },
      left: { text: plain(summary.left), strong: true },
    },
  };

  // ── Whole year sheet: as many months as the window has room for ──
  const yearWidth = useCanvas ? layout.year.w * canvas.width - 18 : canvas.width;
  const available = yearWidth - GUTTER - CATEGORY_COLUMN - NUMBER_COLUMN * 2;
  const monthCount = Math.max(1, Math.min(12, Math.floor(available / 68)));
  const lastIndex = Number(month.slice(5, 7)) - 1;
  const firstIndex = Math.max(0, Math.min(12 - monthCount, lastIndex - monthCount + 1));
  const shownMonths = Array.from({ length: monthCount }, (_, offset) => firstIndex + offset);
  const keyOf = (index: number) => `${year}-${String(index + 1).padStart(2, '0')}`;

  const yearColumns: SheetColumn[] = [
    { key: 'name', label: 'Category', width: CATEGORY_COLUMN },
    { key: 'budget', label: 'Budget', align: 'right', width: NUMBER_COLUMN },
    ...shownMonths.map((index) => ({ key: keyOf(index), label: SHORT_MONTHS[index], align: 'right' as const })),
    { key: 'total', label: `${year}`, align: 'right', width: NUMBER_COLUMN },
  ];
  const yearRows: SheetRow[] = ordered.map((category) => {
    const months = yearData[category.id] ?? {};
    return {
      id: category.id,
      onOpen: () => setOpenCategory(category.id),
      cells: {
        name: { text: category.name },
        budget: { text: plain(category.planned), value: category.planned },
        total: { text: plain(Object.values(months).reduce((sum, value) => sum + value, 0)) },
        ...Object.fromEntries(shownMonths.map((index) => [keyOf(index), { text: plain(months[keyOf(index)] ?? 0) }])),
      },
    };
  });
  const sumMonth = (key: string) => Object.values(yearData).reduce((sum, months) => sum + (months[key] ?? 0), 0);
  const yearTotal: SheetRow = {
    id: 'total',
    cells: {
      name: { text: 'Total', strong: true },
      budget: { text: plain(summary.planned), strong: true },
      total: { text: plain(Object.values(yearData).reduce((sum, months) => sum + Object.values(months).reduce((a, b) => a + b, 0), 0)), strong: true },
      ...Object.fromEntries(shownMonths.map((index) => [keyOf(index), { text: plain(sumMonth(keyOf(index))), strong: true }])),
    },
  };

  // ── Transactions sheet ──
  const wide = !useCanvas && canvas.width >= 640;
  const transactionColumns: SheetColumn[] = [
    { key: 'date', label: 'Date', width: 72 },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category', width: wide ? 150 : 104 },
    { key: 'amount', label: 'Amount', align: 'right', width: NUMBER_COLUMN },
    ...(wide ? [{ key: 'source', label: 'From', width: 124 }] : []),
  ];
  const transactionRows: SheetRow[] = budget.transactions
    .filter((transaction) => transaction.date.startsWith(month) && transaction.categoryId !== INCOME_ID)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((transaction) => ({
      id: transaction.id,
      cells: {
        date: { text: dayLabel(transaction.date) },
        description: {
          text: transaction.description,
          node: (
            <div
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(ITEM_DRAG_TYPE, transaction.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              title="Drag onto a category"
              className="cursor-grab truncate active:cursor-grabbing"
            >
              {transaction.description}
            </div>
          ),
        },
        amount: { text: plain(transaction.amount) },
        source: { text: transaction.source ? SOURCE_LABELS[transaction.source] : '' },
        category: {
          text: categoryName(transaction.categoryId),
          node: (
            <select
              aria-label={`Category for ${transaction.description}`}
              value={transaction.categoryId}
              onChange={(event) => {
                onChange(sortMerchant(budget, transaction.description, event.target.value));
                setStatus(`✓ Moved to ${categoryName(event.target.value)}. I'll remember that.`);
                playSound('pop');
              }}
              className="w-full cursor-pointer truncate bg-transparent outline-none"
            >
              <option value={transaction.categoryId}>{categoryName(transaction.categoryId)}</option>
              {categoryOptions.filter((option) => option.id !== transaction.categoryId).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              {transaction.categoryId !== TRANSFER_ID && <option value={TRANSFER_ID}>Not counted</option>}
            </select>
          ),
        },
      },
    }));

  const openTransactions = budget.transactions
    .filter((transaction) => transaction.categoryId === openCategory && transaction.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

  const overspent = ordered
    .map((category) => ({ name: category.name, over: (summary.spentByCategory[category.id] ?? 0) - category.planned }))
    .filter((item) => item.over > 0)
    .sort((a, b) => b.over - a.over)[0];
  const defaultStatus = report
    ? `I read ${report.count} transactions. You spend about ${formatMoney(report.monthlySpend)} a month and bring in ${formatMoney(report.monthlyIncome)}.`
    : overspent
      ? `${overspent.name} is ${formatMoney(overspent.over)} over budget this month`
      : `${budget.transactions.length} transactions in this sheet`;

  const dropOnCategory = useCallback((categoryId: string, transactionId: string) => {
    const transaction = budget.transactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    onChange(sortMerchant(budget, transaction.description, categoryId));
    setStatus(`✓ ${transaction.description} moved to ${categoryName(categoryId)}. I'll remember that.`);
    playSound('success');
  }, [budget, onChange]);

  const updateCard = (id: CardId, next: CardLayout) => {
    const updated = { ...layout, [id]: next };
    setLayout(updated);
    saveLayout(updated);
  };

  const bringForward = (id: CardId) => {
    setOrder((current) => (current[current.length - 1] === id ? current : [...current.filter((item) => item !== id), id]));
  };

  const tidyUp = () => {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
    setStatus('✓ Tidied up');
    playSound('complete');
  };

  const monthGrid = (
    <SheetGrid
      key={`month-${month}`}
      columns={monthColumns}
      rows={monthRows}
      total={monthTotal}
      fillKey={fillKey}
      onEdit={(rowId, _column, value) => setPlanned(rowId, value)}
      onDropItem={dropOnCategory}
    />
  );

  const yearGrid = (
    <SheetGrid
      key={`year-${year}-${monthCount}`}
      columns={yearColumns}
      rows={yearRows}
      total={yearTotal}
      fillKey={fillKey}
      onEdit={(rowId, _column, value) => setPlanned(rowId, value)}
      onDropItem={dropOnCategory}
    />
  );

  const transactionsGrid = (
    <SheetGrid key={`transactions-${month}`} columns={transactionColumns} rows={transactionRows} fillKey={fillKey} />
  );

  const cardZ = (id: CardId) => order.indexOf(id) + 1;

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
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
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.txt,.pdf,image/*"
        className="sr-only"
        aria-label="Add a statement, screenshot or receipt"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onAddFile(file);
          event.target.value = '';
        }}
      />
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {!useCanvas && (
          <div className="flex items-baseline gap-2">
            <h1 className="font-serif text-[clamp(28px,5vh,40px)] leading-none">
              <Ticking value={Math.abs(summary.left)} format={formatMoney} />
            </h1>
            <p className="text-[14px] text-[var(--pf-text-secondary)]">{summary.left >= 0 ? 'left to spend' : 'over budget'}</p>
          </div>
        )}
        <span className="flex items-center gap-2 text-[14px] text-[var(--pf-text-secondary)]">
          <button type="button" aria-label="Previous month" disabled={month <= earliestMonth} className="cursor-pointer disabled:opacity-25" onClick={() => { onMonthChange(shiftMonth(month, -1)); playSound('tap'); }}>←</button>
          <span className="text-[var(--pf-text-primary)]">{monthLabel(month)}</span>
          <button type="button" aria-label="Next month" disabled={month >= latestMonth} className="cursor-pointer disabled:opacity-25" onClick={() => { onMonthChange(shiftMonth(month, 1)); playSound('tap'); }}>→</button>
        </span>
        <div className="order-last flex h-10 min-w-[240px] flex-1 basis-full items-center rounded-full bg-[var(--pf-bg-elevated)] px-4 transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--pf-text-primary)] lg:order-none lg:basis-0">
          <label htmlFor="pf-quick" className="sr-only">Add spending</label>
          <input
            id="pf-quick"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') addEntry(); }}
            placeholder="Drop a screenshot, statement or receipt anywhere. I'll fill it in."
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--pf-text-tertiary)]"
          />
        </div>
        <div className="ml-auto flex items-center gap-4 text-[14px] lg:ml-0">
          {useCanvas && <button type="button" className="pf-link" onClick={tidyUp}>Tidy up</button>}
          <button type="button" className="pf-link" onClick={() => setShowConnections(true)}>Connections</button>
          <button type="button" className="pf-btn pf-btn-primary h-9 px-4 text-[14px]" onClick={() => { fileInput.current?.click(); playSound('tap'); }}>Add data</button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`relative mt-2 flex min-h-0 flex-1 flex-col ${useCanvas ? '-mx-2 overflow-hidden rounded-[16px] p-0' : ''}`}
        style={useCanvas ? { backgroundImage: 'radial-gradient(var(--pf-border) 1px, transparent 1px)', backgroundSize: '12px 12px' } : undefined}
      >
        {useCanvas ? (
          canvas.width > 0 && (
            <>
              <CanvasCard title={isSample ? `Sample family · ${monthLabel(month)}` : monthLabel(month)} layout={layout.summary} canvas={canvas} zIndex={cardZ('summary')} onChange={(next) => updateCard('summary', next)} onFocus={() => bringForward('summary')}>
                <div className="flex h-full flex-col justify-center px-1">
                  <p className="font-serif text-[clamp(28px,5vh,44px)] leading-none"><Ticking value={Math.abs(summary.left)} format={formatMoney} /></p>
                  <p className="mt-1 truncate text-[14px] text-[var(--pf-text-secondary)]">{summary.left >= 0 ? 'left to spend' : 'over budget'}</p>
                  <p className="truncate text-[13px] text-[var(--pf-text-tertiary)]">{formatMoney(summary.spent)} of {formatMoney(summary.planned)}</p>
                </div>
              </CanvasCard>
              <CanvasCard title="Connections" layout={layout.connect} canvas={canvas} zIndex={cardZ('connect')} onChange={(next) => updateCard('connect', next)} onFocus={() => bringForward('connect')}>
                <div className="hide-scrollbar min-h-0 flex-1 overflow-hidden">
                  <ConnectList compact budget={isSample ? null : budget} onFile={(file, source) => onAddFile(file, source)} onPaste={() => setShowPaste(true)} onAuto={() => setShowWallet(true)} />
                </div>
              </CanvasCard>
              <CanvasCard title="Purchases" layout={layout.transactions} canvas={canvas} zIndex={cardZ('transactions')} onChange={(next) => updateCard('transactions', next)} onFocus={() => bringForward('transactions')}>
                <CompactPurchases rows={transactionRows} />
              </CanvasCard>
              <CanvasCard title="This month" layout={layout.month} canvas={canvas} zIndex={cardZ('month')} onChange={(next) => updateCard('month', next)} onFocus={() => bringForward('month')}>
                {monthGrid}
              </CanvasCard>
              <CanvasCard title="Whole year" layout={layout.year} canvas={canvas} zIndex={cardZ('year')} onChange={(next) => updateCard('year', next)} onFocus={() => bringForward('year')}>
                {yearGrid}
              </CanvasCard>
            </>
          )
        ) : (
          <>
            {tab === 'month' && monthGrid}
            {tab === 'year' && yearGrid}
            {tab === 'transactions' && transactionsGrid}
          </>
        )}

        {steps && (
          <div className="absolute left-1/2 top-1/2 z-40 w-[min(92%,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-[var(--pf-text-primary)] bg-[var(--pf-bg-primary)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
            <AgentSteps steps={steps} />
          </div>
        )}
      </div>

      <div className={`mt-1 flex h-9 shrink-0 items-stretch gap-3 ${useCanvas ? '' : 'border-t border-[var(--pf-text-primary)]'}`}>
        {!useCanvas && (
          <div role="tablist" aria-label="Sheets" className="flex shrink-0">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => { setTab(item.id); playSound('tap'); }}
                className={`-mt-px cursor-pointer border-x border-b px-2.5 text-[13px] sm:px-3.5 ${tab === item.id ? 'border-[var(--pf-text-primary)] bg-[var(--pf-bg-primary)] font-semibold' : 'border-transparent text-[var(--pf-text-secondary)] hover:text-[var(--pf-text-primary)]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div className={`flex min-w-0 flex-1 items-center gap-3 text-[13px] text-[var(--pf-text-secondary)] ${useCanvas ? 'flex-row-reverse justify-end' : 'justify-end'}`}>
          {unsure && !isSample && (
            <button type="button" className="shrink-0 cursor-pointer font-semibold text-[var(--pf-text-primary)] underline underline-offset-4" onClick={() => { setReviewing(true); playSound('tap'); }}>
              {unsure.remaining} to check
            </button>
          )}
          <span className="hidden min-w-0 truncate sm:block" aria-live="polite">{problem ?? status ?? (isSample ? 'This is a sample family. Connect yours and I\'ll replace it.' : defaultStatus)}</span>
        </div>
      </div>

      {dragging && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-[var(--pf-text-primary)] bg-[var(--pf-bg-primary)]/90">
          <p className="font-serif text-[32px]">Drop it. I&rsquo;ll fill in the sheet.</p>
        </div>
      )}

      <AnimatePresence>
        {openCategory && (
          <Sheet title={openName} onClose={() => setOpenCategory(null)}>
            <ul>
              {openTransactions.length === 0 && <li className="py-3 text-[15px] text-[var(--pf-text-secondary)]">Nothing in {monthLabel(month)} yet.</li>}
              {openTransactions.map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-3 border-b border-[var(--pf-border)] py-2 text-[15px]">
                  <span className="min-w-0">
                    <span className="block truncate">{transaction.description}</span>
                    <span className="text-[13px] text-[var(--pf-text-tertiary)]">{dayLabel(transaction.date)}</span>
                  </span>
                  <span className="shrink-0">{formatMoney(transaction.amount)}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        )}

        {reviewing && (
          <Sheet title="Help me sort this" onClose={() => setReviewing(false)}>
            {unsure ? (
              <div>
                <p className="font-serif text-[24px] leading-tight">{unsure.transaction.description}</p>
                <p className="mt-1 text-[16px] text-[var(--pf-text-secondary)]">
                  {formatMoney(unsure.transaction.amount)} on {dayLabel(unsure.transaction.date)}
                  {unsure.sameMerchant > 1 ? `, and ${unsure.sameMerchant - 1} more like it` : ''}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {categoryOptions.map((option) => (
                    <button key={option.id} type="button" className="pf-pill" onClick={() => { onChange(sortMerchant(budget, unsure.transaction.description, option.id)); playSound('success'); }}>
                      {option.name}
                    </button>
                  ))}
                  <button type="button" className="pf-pill" onClick={() => { onChange(sortMerchant(budget, unsure.transaction.description, TRANSFER_ID)); playSound('success'); }}>
                    Not spending
                  </button>
                </div>
                <p className="mt-4 text-[14px] text-[var(--pf-text-tertiary)]">I&rsquo;ll remember this for next time.</p>
              </div>
            ) : (
              <p className="text-[17px]">✓ All sorted. Thanks.</p>
            )}
          </Sheet>
        )}

        {showPaste && (
          <Sheet title="Paste a receipt or bank alert" onClose={() => setShowPaste(false)}>
            <label htmlFor="pf-paste" className="sr-only">Pasted text</label>
            <textarea
              id="pf-paste"
              autoFocus
              rows={7}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Paste a bank alert, order email or receipt"
              className="w-full resize-none rounded-[12px] bg-[var(--pf-bg-elevated)] p-3 text-[15px] outline-none"
            />
            <p className="mt-2 text-[14px] text-[var(--pf-text-tertiary)]">Claude reads it to find the amounts.</p>
            <button
              type="button"
              className="pf-btn pf-btn-primary mt-3 h-11 w-full"
              disabled={pasted.trim().length < 8}
              onClick={() => {
                onAddText(pasted);
                setPasted('');
                setShowPaste(false);
              }}
            >
              Fill in the sheet
            </button>
          </Sheet>
        )}

        {showWallet && (
          <Sheet title="Every tap, automatically" onClose={() => setShowWallet(false)}>
            <p className="text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">Set this up once on your iPhone. After that, each Apple Pay tap lands in your sheet by itself. No password needed.</p>
            <ol className="mt-3 flex flex-col gap-2 text-[16px]">
              {[
                'Open the Shortcuts app and tap Automation.',
                'Tap the plus, then choose Transaction.',
                'Pick your cards, then Run Immediately.',
                'Add Open URLs and paste the link below.',
                'Swap AMOUNT and MERCHANT for the blue Shortcut values.',
              ].map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pf-text-primary)] text-[13px] text-[var(--pf-text-inverse)]">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-[var(--pf-bg-elevated)] p-3">
              <code className="min-w-0 flex-1 break-all text-[13px]">{walletLink}</code>
              <button
                type="button"
                className="pf-btn pf-btn-secondary h-9 shrink-0 px-4 text-[13px]"
                onClick={() => {
                  void navigator.clipboard?.writeText(walletLink);
                  setCopied(true);
                  playSound('pop');
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-[14px] text-[var(--pf-text-tertiary)]">Works once Pathfinder is online at a real address. In-store Apple Pay only, and it saves to the browser on that phone.</p>
          </Sheet>
        )}

        {showConnections && (
          <Sheet title="Connections" onClose={() => { setShowConnections(false); setConfirmingReset(false); }}>
            <ConnectList
              budget={isSample ? null : budget}
              onFile={(file, source) => { setShowConnections(false); onAddFile(file, source); }}
              onPaste={() => { setShowConnections(false); setShowPaste(true); }}
              onAuto={() => { setShowConnections(false); setShowWallet(true); }}
            />
            <div className="mt-3 flex flex-col items-start gap-1 border-t border-[var(--pf-border)] pt-3">
              {isSample && onFromNumbers && (
                <button type="button" className="pf-link text-[15px]" onClick={() => { setShowConnections(false); onFromNumbers(); playSound('success'); }}>Start from my Pathfinder numbers</button>
              )}
              {hasNumbers && !isSample && (
                <button
                  type="button"
                  className="pf-link text-[15px]"
                  onClick={() => {
                    onUpdateProfile(profileWithBudget(profile, budget));
                    setStatus('✓ Your plans now use this budget');
                    setShowConnections(false);
                    playSound('success');
                  }}
                >
                  Use this budget in my plans
                </button>
              )}
              <div className="mt-1 flex w-full items-center gap-3">
                <label htmlFor="pf-new-category" className="sr-only">New category</label>
                <input
                  id="pf-new-category"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') addCategory(); }}
                  placeholder="Add a category"
                  className="min-w-0 flex-1 border-b-2 border-[var(--pf-border)] bg-transparent py-1 text-[15px] outline-none placeholder:text-[var(--pf-text-tertiary)] focus:border-[var(--pf-text-primary)]"
                />
                <button type="button" className="pf-link" onClick={addCategory}>Add</button>
              </div>
              <p className="mt-1 text-[14px] text-[var(--pf-text-secondary)]">
                Money in: {formatMoney(received > 0 ? received : budget.income)} · Budgeted: {formatMoney(totalPlanned(budget))}
              </p>
              {!isSample && (confirmingReset ? (
                <span className="mt-1 flex items-center gap-4 text-[14px]">
                  Delete this budget?
                  <button type="button" className="pf-link underline decoration-current" onClick={onStartOver}>Yes, delete it</button>
                  <button type="button" className="pf-link" onClick={() => setConfirmingReset(false)}>Keep it</button>
                </span>
              ) : (
                <button type="button" className="pf-link mt-1" onClick={() => setConfirmingReset(true)}>Start over</button>
              ))}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}


function CompactPurchases({ rows }: { rows: SheetRow[] }) {
  const [listRef, height] = useElementSize<HTMLUListElement>();
  const fits = Math.max(1, Math.floor(height.height / 42));
  const shown = rows.slice(0, fits);

  return (
    <ul ref={listRef} className="min-h-0 flex-1 overflow-hidden">
      {shown.map((row) => (
        <li key={row.id} className="flex h-[42px] items-center justify-between gap-2 border-b border-[var(--pf-border)] px-1 last:border-b-0">
          <span className="min-w-0 flex-1 text-[14px]">
            <span className="block truncate">{row.cells.description.node}</span>
            <span className="block truncate text-[12px] text-[var(--pf-text-tertiary)]">{row.cells.date.text} · {row.cells.category.text}</span>
          </span>
          <span className="shrink-0 text-[14px]">{row.cells.amount.text}</span>
        </li>
      ))}
      {rows.length === 0 && <li className="p-2 text-[14px] text-[var(--pf-text-secondary)]">Nothing this month yet.</li>}
    </ul>
  );
}
