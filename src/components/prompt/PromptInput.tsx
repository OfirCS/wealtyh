"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SuggestionChip } from "@/lib/types";
import SuggestionChips from "./SuggestionChips";

interface PromptInputProps {
  onSubmit: (event: string) => void;
  chips: SuggestionChip[];
}

export default function PromptInput({ onSubmit, chips }: PromptInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isValid = text.trim().length > 10;

  // Auto-expand textarea up to a max height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "24px"; // Reset height to recalculate
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(scrollHeight, 120)}px`;
  }, [text]);

  const handleChipSelect = useCallback((prompt: string) => {
    setText(prompt);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to end
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 50);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    onSubmit(text.trim());
  }, [text, isValid, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
      className="flex flex-col bg-[var(--ws-bg-primary)] shadow-[0_-12px_40px_rgba(0,0,0,0.08)] rounded-t-[32px] px-4 pb-8 pt-2 border-t border-[var(--ws-border)]"
    >
      <div
        className="flex justify-center w-full mb-1 cursor-pointer py-2 hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--ws-border)]" />
      </div>

      <div className="px-2 mb-6">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v5" />
              <path d="M12 16v5" />
              <path d="M3 12h5" />
              <path d="M16 12h5" />
              <path d="M6 6l3.5 3.5" />
              <path d="M14.5 15.5l3.5 3.5" />
              <path d="M5 19 L 10 14 C 12 12, 12 12, 14 10 L 19 5" />
            </svg>
          </div>
          <h3 className="font-serif text-[24px] text-[var(--ws-text-primary)] tracking-tight leading-tight">
            Pathfinder AI
          </h3>
        </div>
        <p className="text-[14px] text-[var(--ws-text-secondary)] leading-relaxed">
          Navigating a big life change? <span className="font-semibold text-[var(--ws-text-primary)]">Wealthy's AI agents</span> analyze your finances to build a clear, step-by-step plan for your next chapter.
        </p>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mb-4">
              <SuggestionChips chips={chips} onSelect={handleChipSelect} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-end bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-[28px] shadow-sm pr-2 pl-6 py-2 transition-all focus-within:ring-2 focus-within:ring-[var(--ws-text-primary)] focus-within:border-transparent">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="I'm thinking about quitting my job to..."
          className="flex-1 bg-transparent text-[16px] font-medium text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-tertiary)] focus:outline-none resize-none py-2.5 leading-relaxed overflow-y-auto hide-scrollbar"
          rows={1}
          style={{ minHeight: "24px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`w-11 h-11 mb-0.5 ml-3 shrink-0 rounded-full flex items-center justify-center transition-all ${isValid
            ? "bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] shadow-md cursor-pointer hover:scale-105 active:scale-95"
            : "bg-[var(--ws-border)] text-[var(--ws-text-tertiary)] cursor-not-allowed opacity-70"
            }`}
          aria-label="Submit prompt"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
