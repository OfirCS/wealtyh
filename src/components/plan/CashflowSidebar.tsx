"use client";

import { motion } from "framer-motion";
import type { CashflowPoint } from "@/lib/types";

interface CashflowCardProps {
  cashflow: CashflowPoint[];
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted =
    abs >= 1000
      ? `$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
      : `$${abs.toLocaleString()}`;
  return amount < 0 ? `-${formatted}` : `+${formatted}`;
}

export default function CashflowCard({ cashflow }: CashflowCardProps) {
  // Calculate max absolute value for proportional bar widths
  const maxAbs = Math.max(...cashflow.map((p) => Math.abs(p.amount)));

  return (
    <motion.div
      className="bg-[var(--ws-bg-surface)] rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] p-5 shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
    >
      <p className="text-[var(--ws-text-tertiary)] uppercase text-[14px] tracking-[0.06em] font-medium mb-4">
        Monthly Cash Flow
      </p>

      <div className="space-y-3">
        {cashflow.map((point, i) => {
          const isNegative = point.amount < 0;
          const barWidth = Math.max(
            8,
            (Math.abs(point.amount) / maxAbs) * 100
          );

          return (
            <div key={i} className="flex items-center gap-3">
              {/* Phase label */}
              <span className="text-[var(--ws-text-secondary)] text-[13px] w-[90px] flex-shrink-0 truncate">
                {point.phase}
              </span>

              {/* Bar */}
              <div className="flex-1 h-[14px] bg-[var(--ws-bg-surface)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: isNegative
                      ? "var(--ws-accent-red)"
                      : "var(--ws-accent-green)",
                    opacity: isNegative ? 0.7 : 0.5,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                    delay: 0.4 + i * 0.08,
                  }}
                />
              </div>

              {/* Amount */}
              <span
                className={`text-[13px] font-medium tabular-nums flex-shrink-0 w-[60px] text-right ${isNegative
                    ? "text-[var(--ws-accent-red)]"
                    : "text-[var(--ws-text-primary)]"
                  }`}
              >
                {formatAmount(point.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
