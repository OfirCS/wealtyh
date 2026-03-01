"use client";

import { motion } from "framer-motion";
import type { SuggestionChip } from "@/lib/types";

interface SuggestionChipsProps {
  chips: SuggestionChip[];
  onSelect: (prompt: string) => void;
}

const chipColors = [
  "rgba(100, 160, 255, 0.12)",
  "rgba(160, 120, 255, 0.12)",
  "rgba(80, 200, 170, 0.10)",
  "rgba(255, 160, 100, 0.10)",
  "rgba(200, 100, 255, 0.10)",
  "rgba(100, 220, 200, 0.10)",
];

export default function SuggestionChips({
  chips,
  onSelect,
}: SuggestionChipsProps) {
  return (
    <div className="flex overflow-x-auto hide-scrollbar gap-2.5 w-full pb-1 px-1 -mx-1">
      {chips.map((chip, i) => (
        <motion.button
          key={chip.label}
          type="button"
          onClick={() => onSelect(chip.prompt)}
          className="cursor-pointer whitespace-nowrap flex-shrink-0 rounded-[20px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#bbb] transition-colors hover:text-white hover:border-[rgba(255,255,255,0.18)]"
          style={{
            background: `linear-gradient(135deg, ${chipColors[i % chipColors.length]} 0%, rgba(255,255,255,0.03) 100%)`,
          }}
          initial={{ opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            bounce: 0.2,
            duration: 0.6,
            delay: 0.5 + i * 0.08,
          }}
          whileHover={{
            scale: 1.05,
            borderColor: "rgba(255,255,255,0.2)",
          }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="mr-1.5">{chip.emoji}</span>
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
