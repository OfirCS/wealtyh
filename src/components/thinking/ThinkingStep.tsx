"use client";

import { motion } from "framer-motion";

interface ThinkingLineProps {
  text: string;
  status: "pending" | "active" | "complete";
}

export default function ThinkingStep({ text, status }: ThinkingLineProps) {
  return (
    <motion.div
      className="flex items-center gap-3 py-2"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
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
          <motion.span
            className="text-[16px] leading-none"
            style={{ color: "var(--ws-text-primary)" }}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            &#9679;
          </motion.span>
        )}
        {status === "complete" && (
          <motion.span
            className="text-[14px] leading-none font-bold"
            style={{ color: "var(--ws-accent-green)" }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            &#10003;
          </motion.span>
        )}
      </div>

      {/* Text */}
      <span
        className="text-[14px] leading-snug"
        style={{
          color:
            status === "complete"
              ? "var(--ws-text-primary)"
              : status === "active"
              ? "var(--ws-text-secondary)"
              : "var(--ws-text-tertiary)",
        }}
      >
        {text}
      </span>
    </motion.div>
  );
}
