"use client";

import { motion } from "framer-motion";
import type { SuggestionChip } from "@/lib/types";

interface SuggestionChipsProps {
  chips: SuggestionChip[];
  onSelect: (prompt: string) => void;
}

export default function SuggestionChips({
  chips,
  onSelect,
}: SuggestionChipsProps) {
  return (
    <div className="flex overflow-x-auto hide-scrollbar gap-2.5 w-full pb-1 -mx-1 px-1">
      {chips.map((chip, i) => (
        <motion.button
          key={chip.label}
          type="button"
          onClick={() => onSelect(chip.prompt)}
          className="cursor-pointer whitespace-nowrap flex-shrink-0 rounded-[24px] bg-[var(--ws-bg-surface)] border border-[var(--ws-border)] px-4 py-2 text-[14px] font-medium text-[var(--ws-text-secondary)] transition-all duration-300 hover:bg-[var(--ws-bg-hover)] hover:text-[var(--ws-text-primary)] hover:border-[var(--ws-text-tertiary)]"
          initial={{ opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            bounce: 0.2,
            duration: 0.6,
            delay: 0.5 + i * 0.08,
          }}
          whileHover={{
            scale: 1.03,
          }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="mr-1.5 opacity-80">{chip.emoji}</span>
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
