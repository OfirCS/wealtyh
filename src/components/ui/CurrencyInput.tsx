"use client";

import { useState, useCallback } from "react";

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  optional?: boolean;
  placeholder?: string;
}

function formatCurrency(value: number): string {
  if (value === 0) return "";
  return value.toLocaleString("en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export default function CurrencyInput({
  label,
  value,
  onChange,
  optional = false,
  placeholder = "0",
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawInput, setRawInput] = useState("");

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRawInput(value === 0 ? "" : String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseNumber(rawInput);
    onChange(parsed);
  }, [rawInput, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRawInput(e.target.value);
    },
    []
  );

  const displayValue = focused ? rawInput : formatCurrency(value);

  return (
    <div className="flex flex-col gap-2 group">
      <label className="text-[13px] font-semibold tracking-wide text-[var(--ws-text-secondary)] pl-1 transition-colors group-focus-within:text-[var(--ws-text-primary)]">
        {label}
        {optional && (
          <span className="ml-1 text-[var(--ws-text-tertiary)] font-normal">(optional)</span>
        )}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-medium text-[var(--ws-text-primary)]">
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className="w-full rounded-[16px] border border-transparent bg-[var(--ws-bg-primary)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] py-4 pl-9 pr-5 text-right text-[17px] font-semibold text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-tertiary)] focus:bg-[var(--ws-bg-surface)] focus:border-[var(--ws-text-primary)] focus:ring-1 focus:ring-[var(--ws-text-primary)] focus:shadow-none focus:outline-none transition-all duration-200"
        />
      </div>
    </div>
  );
}
