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
    <div className="flex flex-col md:grid md:grid-cols-2 gap-10 md:gap-16">
      {/* Current baseline card & Insight */}
      {current && (
        <motion.div
          className="flex flex-col justify-center"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.1 }}
        >
          <div className="mb-8">
            <h3 className="font-serif text-[28px] sm:text-[36px] text-[var(--ws-text-primary)] leading-[1.1] tracking-tight mb-3">
              Your cash flow remains strong, but we can unlock <span className="text-[var(--ws-accent-green)]">more potential</span> in the later phases.
            </h3>
            <p className="text-[14px] sm:text-[15px] text-[var(--ws-text-secondary)] leading-relaxed">
              Based on your goals, implementing these Pathfinder actions will ensure steady monthly liquidity throughout retirement.
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-[20px] border border-[var(--ws-border)] bg-[var(--ws-bg-surface)]">
            <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
              {current.phase} (Current)
            </p>
            <p className={`font-serif text-[48px] sm:text-[56px] tracking-tight leading-none ${current.amount >= 0 ? "text-[var(--ws-text-primary)]" : "text-[var(--ws-accent-red)]"
              }`}>
              <CountUp value={current.amount} formatFn={formatAmount} duration={1.2} />
              <span className="font-sans text-[18px] text-[var(--ws-text-tertiary)] font-normal ml-1.5 tracking-normal">/mo</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Phase breakdown */}
      <motion.div
        className="flex flex-col pt-8 border-t md:border-t-0 md:pt-0 border-[var(--ws-border)] justify-center"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.2 }}
      >
        <p className="text-[11px] text-[var(--ws-text-tertiary)] uppercase tracking-wider font-semibold mb-6">
          Projected Cash flow by phase
        </p>

        <div className="space-y-6 sm:space-y-8">
          {cashflow.map((point, i) => {
            const isNegative = point.amount < 0;
            const barWidth = Math.max(8, (Math.abs(point.amount) / maxAbs) * 100);

            return (
              <div key={i} className="group flex items-center gap-4">
                <div className="w-[120px] sm:w-[140px] flex-shrink-0">
                  <span className="text-[13px] sm:text-[14px] font-semibold text-[var(--ws-text-primary)]">
                    {point.phase}
                  </span>
                </div>

                <div className="flex-1 flex items-center gap-3 sm:gap-4">
                  <div className="flex-1 h-2.5 sm:h-3 bg-[var(--ws-border)] rounded-full overflow-hidden">
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
                        type: "spring",
                        bounce: 0,
                        duration: 0.8,
                        delay: 0.3 + i * 0.1,
                      }}
                    />
                  </div>
                  <div className="w-[70px] sm:w-[80px] text-right flex-shrink-0">
                    <span
                      className={`font-serif text-[18px] sm:text-[22px] tracking-tight leading-none ${isNegative ? "text-[var(--ws-accent-red)]" : "text-[var(--ws-text-primary)]"
                        }`}
                    >
                      <CountUp value={point.amount} formatFn={formatAmount} duration={1.2} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
