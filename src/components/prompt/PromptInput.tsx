"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SuggestionChip } from "@/lib/types";
import SuggestionChips from "./SuggestionChips";

interface PromptInputProps {
  onSubmit: (event: string) => void;
  chips: SuggestionChip[];
  placeholder?: string;
  initialText?: string;
  autoFocus?: boolean;
}

export default function PromptInput({
  onSubmit,
  chips,
  placeholder,
  initialText = "",
  autoFocus = false,
}: PromptInputProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isValid = text.trim().length > 10;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "24px";
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(scrollHeight, 120)}px`;
  }, [text]);

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = window.setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const at = el.value.length;
      el.selectionStart = at;
      el.selectionEnd = at;
    }, 50);
    return () => window.clearTimeout(timeout);
  }, [autoFocus]);

  const handleChipSelect = useCallback((prompt: string) => {
    setText(prompt);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.15 }}
      className="relative flex flex-col rounded-[32px] px-8 pb-10 pt-2 overflow-hidden bg-[var(--ws-bg-primary)] border border-[var(--ws-border)] shadow-[var(--ws-shadow-lg)]"
    >
      <div
        className="flex justify-center w-full mb-4 cursor-pointer py-3 hover:opacity-80 transition-opacity relative z-10"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--ws-border)]" />
      </div>

      <div className="mb-7 relative z-10 px-1">
        <motion.h3
          className="font-serif text-[32px] text-[var(--ws-text-primary)] tracking-tight leading-none mb-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.3 }}
        >
          Pathfinder AI
        </motion.h3>
        <motion.p
          className="text-[16px] font-medium text-[var(--ws-text-secondary)] leading-relaxed"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Describe what&rsquo;s changing — get a plan.
        </motion.p>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
            className="overflow-hidden relative z-10"
          >
            <div className="mb-6 px-1">
              <SuggestionChips chips={chips} onSelect={handleChipSelect} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Field */}
      <div className="relative z-10 px-1 mt-2">
        <div className="relative flex items-center bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-[24px] pr-2.5 pl-6 py-2 transition-all duration-300 focus-within:border-[var(--ws-text-secondary)] focus-within:shadow-[0_0_0_1px_var(--ws-text-secondary)]">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "What's changing in your life?"}
            className="flex-1 bg-transparent text-[16px] font-medium text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-tertiary)] focus:outline-none resize-none py-3 leading-relaxed overflow-y-auto hide-scrollbar self-center"
            rows={1}
            style={{ minHeight: "24px" }}
          />
          <motion.button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-[42px] h-[42px] shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ml-2 ${isValid
              ? "bg-[var(--ws-text-primary)] text-[var(--ws-bg-primary)] shadow-md cursor-pointer"
              : "bg-[var(--ws-bg-elevated)] text-[var(--ws-text-tertiary)] cursor-not-allowed"
              }`}
            whileHover={isValid ? { scale: 1.05 } : {}}
            whileTap={isValid ? { scale: 0.95 } : {}}
            aria-label="Submit prompt"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "2px", marginBottom: "2px" }}>
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
