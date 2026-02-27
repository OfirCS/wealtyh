"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SuggestionChip } from "@/lib/types";
import Button from "@/components/ui/Button";
import SuggestionChips from "./SuggestionChips";

interface PromptInputProps {
  onSubmit: (event: string) => void;
  chips: SuggestionChip[];
}

export default function PromptInput({ onSubmit, chips }: PromptInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isValid = text.trim().length > 10;

  // Auto-expand textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const handleChipSelect = useCallback((prompt: string) => {
    setText(prompt);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    onSubmit(text.trim());
  }, [text, isValid, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && e.metaKey && isValid) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [isValid, handleSubmit]
  );

  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
      className="flex flex-col bg-[#E8E4DD] rounded-t-[24px] rounded-b-[40px] px-2 -mx-2 -mb-8 pb-10 pt-1"
    >
      <div
        className="flex justify-center w-full mb-2 cursor-pointer py-2 hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-1.5 rounded-full bg-[#D6D2CC]" />
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
            <div className="mb-2">
              <SuggestionChips chips={chips} onSelect={handleChipSelect} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-center bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] rounded-full shadow-sm pr-1.5 pl-5 py-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="I'm thinking about quitting my job to..."
          className="flex-1 bg-transparent text-[15px] font-medium text-[var(--ws-text-primary)] placeholder:text-[#A8A39E] focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${isValid
            ? 'bg-[var(--ws-accent-yellow)] text-[var(--ws-text-primary)] shadow-sm cursor-pointer'
            : 'bg-[#D6D2CC] text-[#AAA6A0] cursor-not-allowed'
            }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
