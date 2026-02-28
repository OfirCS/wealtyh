"use client";

import { motion } from "framer-motion";
import type { CashflowPoint } from "@/lib/types";
import { CountUp } from "@/components/ui/CountUp";

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
    <div className="flex flex-col gap-10">
      {/* Current baseline card */}
      {current && (
        <motion.div
          className="flex flex-col"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
        >
          <p className="text-[12px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
            {current.phase}
          </p>
          <p className={`font-serif text-[64px] tracking-tight leading-none ${current.amount >= 0 ? "text-[var(--ws-text-primary)]" : "text-[var(--ws-accent-red)]"
            }`}>
            <CountUp value={current.amount} formatFn={formatAmount} duration={1.2} />
            <span className="font-sans text-[20px] text-[var(--ws-text-tertiary)] font-normal ml-2 tracking-normal">/mo</span>
          </p>
        </motion.div>
      )}

      {/* Phase breakdown */}
      <motion.div
        className="flex flex-col pt-8 border-t border-[var(--ws-border)]"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
      >
        <p className="text-[12px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-6">
          Cash flow by phase
        </p>

        <div className="space-y-6">
          {cashflow.map((point, i) => {
            const isNegative = point.amount < 0;
            const barWidth = Math.max(8, (Math.abs(point.amount) / maxAbs) * 100);

            return (
              <div key={i} className="group">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-[15px] font-medium text-[var(--ws-text-secondary)]">
                    {point.phase}
                  </span>
                  <span
                    className={`font-serif text-[24px] tracking-tight leading-none ${isNegative ? "text-[var(--ws-accent-red)]" : "text-[var(--ws-text-primary)]"
                      }`}
                  >
                    <CountUp value={point.amount} formatFn={formatAmount} duration={1.2} />
                  </span>
                </div>

                <div className="h-1.5 bg-[var(--ws-border)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: isNegative
                        ? "var(--ws-accent-red)"
                        : "var(--ws-text-primary)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{
                      duration: 0.8,
                      ease: [0.25, 0.1, 0.25, 1],
                      delay: 0.3 + i * 0.1,
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
