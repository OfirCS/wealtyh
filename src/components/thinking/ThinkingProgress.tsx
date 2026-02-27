"use client";

import { motion } from "framer-motion";

interface ThinkingProgressProps {
  progress: number; // 0-100
}

export default function ThinkingProgress({ progress }: ThinkingProgressProps) {
  return (
    <div className="w-full">
      {/* Thin progress bar */}
      <div
        className="w-full h-[3px] rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--ws-bg-surface)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: "var(--ws-accent-yellow)" }}
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Status text */}
      <p
        className="text-[13px] text-center mt-3"
        style={{ color: "var(--ws-text-tertiary)" }}
      >
        Almost there...
      </p>
    </div>
  );
}
