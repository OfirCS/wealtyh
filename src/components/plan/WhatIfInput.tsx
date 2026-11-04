"use client";

import { useCallback, useState } from "react";

interface WhatIfInputProps {
  onSubmit: (adjustment: string) => void;
  isLoading: boolean;
  hint?: string;
}

export default function WhatIfInput({ onSubmit, isLoading, hint }: WhatIfInputProps) {
  const [text, setText] = useState("");
  const isValid = text.trim().length >= 3;

  const handleSubmit = useCallback(() => {
    if (!isValid || isLoading) return;
    onSubmit(text.trim());
    setText("");
  }, [text, isValid, isLoading, onSubmit]);

  return (
    <div>
      <label htmlFor="pf-change" className="font-serif text-[24px]">Want to change anything?</label>
      <div className="mt-4 flex items-center gap-3 border-b-2 border-[var(--pf-border)] pb-2 transition-colors focus-within:border-[var(--pf-text-primary)]">
        <input
          id="pf-change"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="What if it's 12 months?"
          disabled={isLoading}
          className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-[var(--pf-text-tertiary)] disabled:opacity-50"
        />
        <button type="button" onClick={handleSubmit} disabled={!isValid || isLoading} className="pf-link disabled:opacity-40">
          {isLoading ? "Working…" : "Update"}
        </button>
      </div>
      {hint && <p className="mt-2 text-[14px] text-[var(--pf-text-tertiary)]">{hint}</p>}
    </div>
  );
}
