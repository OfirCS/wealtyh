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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "24px";
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(scrollHeight, 120)}px`;
  }, [text]);

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
      className="relative flex flex-col rounded-t-[32px] px-4 pb-8 pt-2 overflow-hidden"
      style={{ background: "#141413" }}
    >
      {/* Animated aurora gradient background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(88, 110, 160, 0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 80% 20%, rgba(120, 90, 150, 0.12) 0%, transparent 50%), radial-gradient(ellipse 70% 40% at 50% 5%, rgba(60, 140, 130, 0.1) 0%, transparent 50%)",
          animation: "aurora 8s ease-in-out infinite alternate",
        }}
      />

      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.15) 50%, transparent 90%)",
        }}
      />

      <div
        className="flex justify-center w-full mb-2 cursor-pointer py-3 hover:opacity-80 transition-opacity relative z-10"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
      </div>

      <div className="px-3 mb-6 relative z-10">
        <div className="flex items-center gap-3.5 mb-3">
          {/* Icon with animated breathing glow */}
          <motion.div
            className="relative"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.8, delay: 0.3 }}
          >
            <div
              className="absolute -inset-2 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, rgba(120,160,255,0.3), rgba(160,120,255,0.2), rgba(100,200,180,0.3), rgba(120,160,255,0.3))",
                animation: "spin 6s linear infinite",
                filter: "blur(8px)",
              }}
            />
            <div
              className="absolute -inset-1 rounded-full"
              style={{
                animation: "breathe 3s ease-in-out infinite",
                background: "radial-gradient(circle, rgba(140,170,255,0.25) 0%, transparent 70%)",
              }}
            />
            <div className="relative w-10 h-10 rounded-full bg-white text-[#141413] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v16M4 12h16M6.34 6.34l11.32 11.32M6.34 17.66L17.66 6.34" />
              </svg>
            </div>
          </motion.div>

          <motion.h3
            className="font-serif text-[28px] text-white tracking-tight leading-none mt-0.5"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.4 }}
          >
            Pathfinder AI
          </motion.h3>
        </div>
        <motion.p
          className="text-[15px] font-medium text-[#9B9B9A] leading-relaxed"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          Ask Pathfinder to build your step-by-step financial plan.
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
            <div className="mb-5 px-1">
              <SuggestionChips chips={chips} onSelect={handleChipSelect} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input with animated gradient border */}
      <div className="relative z-10 rounded-[32px] p-[1.5px] prompt-input-border">
        <div className="relative flex items-end bg-[#1a1a19] rounded-[32px] pr-2 pl-6 py-2.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="I'm thinking about quitting my job to..."
            className="flex-1 bg-transparent text-[16px] font-medium text-white placeholder:text-[#555] focus:outline-none resize-none py-2.5 leading-relaxed overflow-y-auto hide-scrollbar"
            rows={1}
            style={{ minHeight: "24px" }}
          />
          <motion.button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-10 h-10 mb-0.5 shrink-0 rounded-full flex items-center justify-center transition-colors ${isValid
              ? "bg-white text-black cursor-pointer"
              : "bg-[#2a2a29] text-[#555] cursor-not-allowed"
              }`}
            whileHover={isValid ? { scale: 1.08 } : {}}
            whileTap={isValid ? { scale: 0.92 } : {}}
            animate={isValid ? {
              boxShadow: [
                "0 0 12px rgba(140,170,255,0.3)",
                "0 0 20px rgba(140,170,255,0.5)",
                "0 0 12px rgba(140,170,255,0.3)",
              ],
            } : { boxShadow: "0 0 0px rgba(0,0,0,0)" }}
            transition={isValid ? { duration: 2, repeat: Infinity, ease: "easeInOut" as const } : { duration: 0.3 }}
            aria-label="Submit prompt"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="12 19 12 5"></polyline>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
