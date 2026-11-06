'use client';

import { useState } from 'react';
import { monthLabel } from '@/lib/budget';
import type { BudgetCategory, Rhythm, Transaction } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import Sheet from '@/components/ui/Sheet';
import { PurchaseRow } from './Ledger';
import type { OpenMenu } from './Ledger';

interface CategorySheetProps {
  category: BudgetCategory;
  month: string;
  /** What's left this month, for a category with everyday spending in it. */
  left?: number;
  spent?: number;
  /** What it normally comes to in a month. */
  usual?: number;
  /** How much of this budget goes to bills. */
  forBills: number;
  rhythms: Map<string, Rhythm>;
  transactions: Transaction[];
  onRename: (name: string) => void;
  onBudget: (value: number) => void;
  onOpenPurchase: (id: string) => void;
  onMenu: OpenMenu;
  onClose: () => void;
}

function MoneyRow({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));

  const commit = () => {
    const next = Number(text.replace(/[^\d.]/g, '')) || 0;
    if (next !== Math.round(value * 100) / 100) onCommit(next);
  };

  return (
    <label className="flex h-11 items-center justify-between gap-3 text-[15px]">
      {label}
      <span className="flex items-baseline font-bold tabular-nums">
        $
        <input
          inputMode="decimal"
          aria-label={label}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          size={Math.max(2, text.length)}
          className="min-w-0 bg-transparent text-right underline decoration-dotted decoration-[var(--pf-text-tertiary)] underline-offset-4 outline-none"
        />
      </span>
    </label>
  );
}

/** One category: what's left, its budget, and every purchase behind the number. */
export default function CategorySheet({ category, month, left, spent, usual = 0, forBills, rhythms, transactions, onRename, onBudget, onOpenPurchase, onMenu, onClose }: CategorySheetProps) {
  const [name, setName] = useState(category.name);
  const planned = left !== undefined && spent !== undefined ? left + spent : 0;

  const heading = (
    <input
      aria-label="Category name"
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => { if (name.trim() && name.trim() !== category.name) onRename(name.trim()); }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      className="pf-title w-full min-w-0 bg-transparent outline-none first-letter:uppercase"
    />
  );

  return (
    <Sheet title={category.name} heading={heading} onClose={onClose}>
      {left !== undefined && (
        <>
          <p className="pf-number">
            {formatMoney(Math.abs(left))}
            <span className="ml-2 font-sans text-[15px] font-bold tracking-normal">{left >= 0 ? 'left' : 'over'}</span>
          </p>
          <span aria-hidden className="pf-rule pf-rule-flat pf-rule-block mt-2"><span style={{ width: `${planned > 0 ? Math.min(1, (spent ?? 0) / planned) * 100 : 100}%`, background: left < 0 ? 'var(--pf-warn)' : 'var(--pf-good)' }} /></span>
        </>
      )}

      <div className="mt-1 border-b border-[var(--pf-border)]">
        <MoneyRow key={`budget-${category.planned}`} label="Monthly budget" value={category.planned} onCommit={onBudget} />
      </div>
      {(usual >= 1 || forBills >= 1) && <p className="mt-2 text-[13px] text-[var(--pf-text-tertiary)]">{[usual >= 1 ? `Usually ${formatMoney(usual)} a month` : '', forBills >= 1 ? `${formatMoney(forBills)} goes to bills` : ''].filter(Boolean).join(' · ')}</p>}

      <ul className="mt-1">
        {transactions.map((transaction) => <PurchaseRow key={transaction.id} transaction={transaction} rhythm={rhythms.get(transaction.id)} category={name} onOpenPurchase={onOpenPurchase} onMenu={onMenu} />)}
      </ul>
      {transactions.length === 0 && <p className="py-2 text-[15px] text-[var(--pf-text-secondary)]">Nothing in {monthLabel(month)} yet.</p>}
    </Sheet>
  );
}
