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
  const maxAbs = Math.max(...cashflow.map((p) => Math.abs(p.amount)));
  const current = cashflow[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Current baseline card */}
      {current && (
        <motion.div
          className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[#DDD8D1] p-5 shadow-[0_1px_2px_rgba(42,39,36,0.08)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" as const, delay: 0.1 }}
        >
          <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-1">
            {current.phase}
          </p>
          <p className={`text-[34px] font-semibold tabular-nums tracking-[-0.02em] leading-tight ${
            current.amount >= 0 ? "text-[var(--ws-accent-green)]" : "text-[var(--ws-accent-red)]"
          }`}>
            {formatAmount(current.amount)}
            <span className="text-[14px] text-[var(--ws-text-tertiary)] font-medium">/mo</span>
          </p>
        </motion.div>
      )}

      {/* Phase breakdown */}
      <motion.div
        className="bg-[var(--ws-bg-surface)] rounded-[20px] border border-[#DDD8D1] p-5 shadow-[0_1px_2px_rgba(42,39,36,0.08)]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const, delay: 0.2 }}
      >
        <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-4">
          Cash flow by phase
        </p>

        <div className="space-y-4">
          {cashflow.map((point, i) => {
            const isNegative = point.amount < 0;
            const barWidth = Math.max(8, (Math.abs(point.amount) / maxAbs) * 100);

            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-[var(--ws-text-primary)]">
                    {point.phase}
                  </span>
                  <span
                    className={`text-[14px] font-semibold tabular-nums ${
                      isNegative ? "text-[var(--ws-accent-red)]" : "text-[var(--ws-accent-green)]"
                    }`}
                  >
                    {formatAmount(point.amount)}
                  </span>
                </div>

                <div className="h-2.5 bg-[var(--ws-bg-primary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: isNegative
                        ? "var(--ws-accent-red)"
                        : "var(--ws-accent-green)",
                      opacity: isNegative ? 0.6 : 0.4,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{
                      duration: 0.6,
                      ease: "easeOut" as const,
                      delay: 0.3 + i * 0.08,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
