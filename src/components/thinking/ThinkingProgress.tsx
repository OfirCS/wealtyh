"use client";

import { motion } from "framer-motion";

interface ThinkingProgressProps {
  progress: number; // 0-100
}

export default function ThinkingProgress({ progress }: ThinkingProgressProps) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full flex flex-col items-center justify-center mt-6">
      <div className="relative flex items-center justify-center w-[80px] h-[80px]">
        {/* Background Tracker */}
        <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 60 60">
          <circle
            cx="30"
            cy="30"
            r={radius}
            stroke="var(--ws-border)"
            strokeWidth="3"
            fill="transparent"
          />
          {/* Active Progress */}
          <motion.circle
            cx="30"
            cy="30"
            r={radius}
            stroke="var(--ws-text-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="transparent"
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          />
        </svg>
        {/* Percentage Text */}
        <span className="font-serif text-[18px] text-[var(--ws-text-primary)] font-semibold tabular-nums tracking-tight">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Status text */}
      <p className="text-[14px] text-center mt-4 font-medium" style={{ color: "var(--ws-text-secondary)" }}>
        {progress < 100 ? "Building plan..." : "Done"}
      </p>
    </div>
  );
}
