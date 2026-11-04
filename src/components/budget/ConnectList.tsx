'use client';

import { useRef, useState } from 'react';
import type { Budget, TransactionSource } from '@/lib/budget';
import { playSound } from '@/lib/sounds';

interface ConnectListProps {
  budget: Budget | null;
  onFile: (file: File, source: TransactionSource) => void;
  onPaste: () => void;
  onAuto?: () => void;
  compact?: boolean;
}

function Icon({ name }: { name: 'wallet' | 'bank' | 'mail' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {name === 'wallet' && <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 15h2" /></>}
      {name === 'bank' && <path d="M4 10 12 5l8 5M5 10v8m14-8v8M9.500 10v8m5-8v8M3.500 19.500h17" />}
      {name === 'mail' && <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="m4 8 8 6 8-6" /></>}
    </svg>
  );
}

function rowsFrom(budget: Budget | null, source: TransactionSource): number {
  return budget?.transactions.filter((transaction) => transaction.source === source).length ?? 0;
}

/** Where the agent gets its data. Each row says plainly what it can do today. */
export default function ConnectList({ budget, onFile, onPaste, onAuto, compact }: ConnectListProps) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<TransactionSource>('agent');

  const choose = (source: TransactionSource) => {
    playSound('tap');
    if (source === 'mail') {
      onPaste();
      return;
    }
    setPending(source);
    input.current?.click();
  };

  const wallet = rowsFrom(budget, 'wallet');
  const statements = rowsFrom(budget, 'statement') + rowsFrom(budget, 'agent');
  const mail = rowsFrom(budget, 'mail');

  const rows = [
    { icon: 'wallet' as const, name: 'Apple Wallet', status: wallet > 0 ? `✓ ${wallet} purchases read` : 'Send me a screenshot', source: 'wallet' as const },
    { icon: 'bank' as const, name: 'Bank or card', status: statements > 0 ? `✓ ${statements} purchases read` : 'Send me a statement', source: 'agent' as const },
    { icon: 'mail' as const, name: 'Email', status: mail > 0 ? `✓ ${mail} purchases read` : 'Paste a receipt or bank alert', source: 'mail' as const },
  ];

  return (
    <div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.name} className="border-b border-[var(--pf-border)] last:border-b-0">
            <button
              type="button"
              onClick={() => choose(row.source)}
              className={`group flex w-full cursor-pointer items-center gap-3 text-left transition-colors hover:bg-[var(--pf-bg-elevated)] ${compact ? 'h-[42px] px-1' : 'h-[68px] px-3'}`}
            >
              <span className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--pf-bg-elevated)] transition-colors group-hover:bg-[var(--pf-text-primary)] group-hover:text-[var(--pf-text-inverse)] ${compact ? 'h-7 w-7' : 'h-10 w-10'}`}>
                <Icon name={row.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium ${compact ? 'text-[14px]' : 'text-[17px]'}`}>{row.name}</span>
                <span className={`block truncate text-[var(--pf-text-secondary)] ${compact ? 'text-[12px]' : 'text-[14px]'}`}>{row.status}</span>
              </span>
              <span aria-hidden className="shrink-0 text-[var(--pf-text-tertiary)] transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </li>
        ))}
      </ul>
      {onAuto && <button type="button" className="pf-link mt-1 block w-full truncate px-1 text-left text-[13px]" onClick={onAuto}>Log every Apple Pay tap automatically</button>}
      <input
        ref={input}
        type="file"
        accept=".csv,.txt,.pdf,image/*"
        className="sr-only"
        aria-label="Add a statement, screenshot or receipt"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file, pending);
          event.target.value = '';
        }}
      />
    </div>
  );
}
