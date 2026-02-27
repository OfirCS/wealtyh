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
    <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full pb-1 px-1 -mx-1">
      {chips.map((chip) => (
        <motion.button
          key={chip.label}
          type="button"
          onClick={() => onSelect(chip.prompt)}
          className="cursor-pointer whitespace-nowrap flex-shrink-0 rounded-full border border-[var(--ws-border)] bg-[var(--ws-bg-surface)] px-4 py-[7px] text-[13px] font-medium text-[var(--ws-text-primary)] transition-colors hover:bg-[var(--ws-bg-advisor)]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="mr-1.5">{chip.emoji}</span>
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
