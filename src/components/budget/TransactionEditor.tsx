'use client';

import { useRef, useState } from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { tidyName } from '@/lib/agent-insights';
import { categoryName, TRANSFER_ID } from '@/lib/budget';
import type { Transaction, TransactionChange } from '@/lib/budget';
import Sheet from '@/components/ui/Sheet';
import CategoryIcon from './CategoryIcon';
import { seenBy } from './Ledger';

interface TransactionEditorProps {
  transaction: Transaction;
  /** Whether this is set apart from the budget right now. */
  oneTime: boolean;
  categories: { id: string; name: string }[];
  /** How many other purchases share this merchant. */
  sameMerchant: number;
  onSave: (change: TransactionChange, everyTime: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Everything about one purchase, all changeable in one place. */
export default function TransactionEditor({ transaction, oneTime, categories, sameMerchant, onSave, onDelete, onClose }: TransactionEditorProps) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [name, setName] = useState(tidyName(transaction.description));
  const [date, setDate] = useState(transaction.date);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [once, setOnce] = useState(oneTime);
  const [everyTimeChoice, setEveryTime] = useState<boolean | null>(null);
  const [choosing, setChoosing] = useState(false);
  const dateField = useRef<HTMLInputElement>(null);

  const parsed = Number(amount.replace(/[^\d.-]/g, ''));
  const valid = Number.isFinite(parsed) && parsed !== 0 && name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const moved = categoryId !== transaction.categoryId;
  const flipped = once !== oneTime;
  // A new category usually means every time. One-time, by its nature, means just this once
  const everyTime = everyTimeChoice ?? moved;

  const save = () => {
    if (!valid) return;
    const renamed = name.trim() !== tidyName(transaction.description);
    onSave({
      amount: Math.round(parsed * 100) / 100,
      date,
      categoryId,
      ...(renamed ? { description: name.trim() } : {}),
      ...(flipped ? { once } : {}),
    }, (moved || flipped) && everyTime);
  };

  const choices = [...categories.filter((category) => category.id !== 'other'), { id: TRANSFER_ID, name: 'Not spending' }];
  if (!choices.some((choice) => choice.id === categoryId)) choices.unshift({ id: categoryId, name: categoryName(categoryId) });

  const sources = seenBy(transaction);
  const heading = (
    <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} className="pf-title w-full min-w-0 bg-transparent outline-none" />
  );

  return (
    <Sheet title="Edit purchase" heading={heading} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <div className="pf-number flex items-baseline">
          <span>$</span>
          <label className="sr-only" htmlFor="pf-edit-amount">Amount</label>
          <input
            id="pf-edit-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onFocus={(event) => event.target.select()}
            className="w-full min-w-0 bg-transparent outline-none"
          />
        </div>

        <ul className="mt-2 divide-y divide-[var(--pf-border)] border-y border-[var(--pf-border)] text-[15px]">
          <li>
            <label className="relative flex h-11 cursor-pointer items-center justify-between gap-3" onClick={() => dateField.current?.showPicker?.()}>
              Date
              <span className="font-bold">{date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick a day'}</span>
              <input ref={dateField} type="date" aria-label="Date" value={date} onChange={(event) => setDate(event.target.value)} className="absolute inset-0 opacity-0" />
            </label>
          </li>
          <li>
            <button type="button" aria-expanded={choosing} onClick={() => setChoosing(!choosing)} className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 text-left">
              Category
              <span className="flex min-w-0 items-center gap-1 font-bold">
                <span className="truncate">{choices.find((choice) => choice.id === categoryId)?.name}</span>
                <ChevronDown size={16} className={`shrink-0 text-[var(--pf-text-tertiary)] transition-transform ${choosing ? 'rotate-180' : ''}`} aria-hidden />
              </span>
            </button>
            {choosing && (
              <div className="grid grid-cols-2 gap-x-3 pb-2">
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    aria-pressed={categoryId === choice.id}
                    onClick={() => { setCategoryId(choice.id); setChoosing(false); }}
                    className={`flex h-10 min-w-0 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-left text-[15px] transition-colors ${categoryId === choice.id ? 'bg-[var(--pf-bg-elevated)] font-bold' : 'hover:bg-[var(--pf-bg-hover)]'}`}
                  >
                    <CategoryIcon id={choice.id} size={18} plain />
                    <span className="min-w-0 truncate">{choice.name}</span>
                  </button>
                ))}
              </div>
            )}
          </li>
          <li>
            <button type="button" role="switch" aria-checked={once} onClick={() => setOnce(!once)} className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-1.5 text-left">
              <span className="min-w-0 leading-tight">
                One-time
                {once && <span className="block text-[13px] text-[var(--pf-text-tertiary)]">Stays out of your budget</span>}
              </span>
              <span aria-hidden className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${once ? 'justify-end bg-[var(--pf-text-primary)]' : 'bg-[var(--pf-bg-dark)]'}`}>
                <span className="h-5 w-5 rounded-full bg-[var(--pf-bg-surface)]" />
              </span>
            </button>
          </li>
          {sources.length > 0 && (
            <li className="flex min-h-11 items-center justify-between gap-3 py-1.5">
              Seen by
              <span className="min-w-0 text-right font-bold">{sources.join(' + ')}{sources.length > 1 && <span className="block text-[13px] text-[var(--pf-text-tertiary)]">Counted once</span>}</span>
            </li>
          )}
        </ul>

        {(moved || flipped) && (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[15px]">
            <input type="checkbox" checked={everyTime} onChange={(event) => setEveryTime(event.target.checked)} className="sr-only" />
            <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] ${everyTime ? 'bg-[var(--pf-text-primary)] text-[var(--pf-text-inverse)]' : 'shadow-[inset_0_0_0_1.5px_var(--pf-text-tertiary)]'}`}>{everyTime && <Check size={14} strokeWidth={2.5} />}</span>
            <span className="min-w-0">Every time{sameMerchant > 0 ? ` (${sameMerchant} more)` : ''}</span>
          </label>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onDelete} className="flex cursor-pointer items-center gap-1.5 text-[15px] text-[var(--pf-warn)]"><Trash2 size={15} aria-hidden /> Delete</button>
          <button type="submit" disabled={!valid} className="pf-btn pf-btn-primary h-11 shrink-0 rounded-[10px] px-7">Save</button>
        </div>
      </form>
    </Sheet>
  );
}
