"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";

interface WhatIfInputProps {
  onSubmit: (adjustment: string) => void;
  isLoading: boolean;
}

const PLACEHOLDERS = [
  "Wait 6 months?",
  "Skip RRSP",
  "More aggressive",
  "Income drops?",
];

export default function WhatIfInput({ onSubmit, isLoading }: WhatIfInputProps) {
  const [text, setText] = useState("");
  const placeholderIdx = 0;

  const isValid = text.trim().length >= 3;

  const handleSubmit = useCallback(() => {
    if (!isValid || isLoading) return;
    onSubmit(text.trim());
    setText("");
  }, [text, isValid, isLoading, onSubmit]);

  return (
    <motion.div
      className="w-full mt-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.3 }}
    >
      <p className="text-[11px] font-semibold text-[var(--ws-text-tertiary)] uppercase tracking-wider mb-2 px-1">
        Refine
      </p>
      <div className="flex items-center gap-2 bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-[16px] p-2 pl-4">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="flex-shrink-0 text-[var(--ws-text-tertiary)]"
        >
          <path
            d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={PLACEHOLDERS[placeholderIdx]}
          disabled={isLoading}
          className="flex-1 bg-transparent text-[14px] text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-tertiary)] outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
            isValid && !isLoading
              ? "bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] cursor-pointer hover:opacity-90"
              : "bg-[var(--ws-bg-primary)] text-[var(--ws-text-tertiary)] cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <motion.svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" fill="transparent" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="transparent" />
            </motion.svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </motion.div>
  );
}
