'use client';

import { useId } from 'react';

interface AmountInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Hides the label visually when the question above already says it. */
  hideLabel?: boolean;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

/** A plain dollar field: shows commas as you type, and stays empty rather than showing 0. */
export default function AmountInput({ label, value, onChange, hideLabel, size = 'lg', autoFocus, inputRef }: AmountInputProps) {
  const id = useId();
  const large = size === 'lg';

  return (
    <div className={large ? '' : 'flex items-center justify-between gap-6'}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : large ? 'mb-2 block text-[15px] text-[var(--pf-text-secondary)]' : 'text-[16px]'}>
        {label}
      </label>
      <div className={`flex items-baseline border-b-2 border-[var(--pf-border)] transition-colors focus-within:border-[var(--pf-text-primary)] ${large ? 'pf-amount pb-2 font-serif' : 'w-[150px] justify-end pb-1 text-[20px]'}`}>
        <span aria-hidden className="mr-1 text-[var(--pf-text-tertiary)]">$</span>
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value > 0 ? value.toLocaleString('en-CA') : ''}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, '').slice(0, 9);
            onChange(digits ? Number(digits) : 0);
          }}
          className={`min-w-0 flex-1 bg-transparent text-[var(--pf-text-primary)] outline-none placeholder:text-[var(--pf-bg-dark)] ${large ? '' : 'text-right'}`}
        />
      </div>
    </div>
  );
}
