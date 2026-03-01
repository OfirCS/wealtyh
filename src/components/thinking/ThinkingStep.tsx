"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThinkingLineProps {
  text: string;
  status: "pending" | "active" | "complete";
}

const SUB_TASKS = [
  "Fetching live data points...",
  "Running Monte Carlo simulations...",
  "Applying latest tax rules...",
  "Optimizing cash flow paths...",
  "Evaluating risk scenarios...",
  "Cross-referencing historical data...",
];

export default function ThinkingStep({ text, status }: ThinkingLineProps) {
  const [subTaskIndex, setSubTaskIndex] = useState(0);

  useEffect(() => {
    if (status !== "active") return;

    // Cycle through subtasks rapidly
    const interval = setInterval(() => {
      setSubTaskIndex((prev) => (prev + 1) % SUB_TASKS.length);
    }, 800); // Change subtask every 800ms

    return () => clearInterval(interval);
  }, [status]);
  return (
    <motion.div
      className="flex items-center gap-3 py-2"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.5 }}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {status === "pending" && (
          <span
            className="text-[16px] leading-none"
            style={{ color: "var(--ws-text-tertiary)" }}
          >
            &#9675;
          </span>
        )}
        {status === "active" && (
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[var(--ws-text-primary)]"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.2"
              fill="transparent"
            />
            <motion.circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray="40 100"
              animate={{
                strokeDashoffset: [0, -100],
                rotate: [0, 90, 180, 270, 360]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.svg>
        )}
        {status === "complete" && (
          <motion.span
            className="text-[14px] leading-none font-bold"
            style={{ color: "var(--ws-accent-green)" }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          >
            &#10003;
          </motion.span>
        )}
      </div>

      {/* Text block */}
      <div className="flex flex-col flex-1 pb-1 pt-0.5 min-w-0">
        <span
          className="text-[14px] leading-snug font-medium transition-colors duration-300"
          style={{
            color:
              status === "complete"
                ? "var(--ws-text-primary)"
                : status === "active"
                  ? "var(--ws-text-primary)"
                  : "var(--ws-text-tertiary)",
          }}
        >
          {text}
        </span>

        {/* Rapidly cycling sub-tasks mimicking deep AI thought */}
        <AnimatePresence mode="popLayout">
          {status === "active" && (
            <motion.div
              layout
              initial={{ opacity: 0, height: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
              exit={{ opacity: 0, height: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.3 }}
              className="mt-0.5 pt-1 overflow-hidden"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={subTaskIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5, position: "absolute" }}
                  transition={{ duration: 0.2 }}
                  className="text-[11px] font-mono tracking-wider leading-relaxed text-[var(--ws-text-secondary)] uppercase"
                >
                  {SUB_TASKS[(subTaskIndex + text.length) % SUB_TASKS.length]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
