"use client";

import { motion } from "framer-motion";
import { formatMoney } from "@/lib/money";
import type { CashflowPoint } from "@/lib/types";

interface MoneyStagesProps {
  cashflow: CashflowPoint[];
}

const MAX_STAGES = 4;

/** Keeps the start, the end and the tightest moment when a plan has many stages. */
function pickStages(cashflow: CashflowPoint[]): CashflowPoint[] {
  if (cashflow.length <= MAX_STAGES) return cashflow;
  const last = cashflow.length - 1;
  const lowest = cashflow.slice(1, last).reduce((best, point) => (point.amount < best.amount ? point : best), cashflow[1]);
  const middle = cashflow.slice(1, last).find((point) => point !== lowest) ?? cashflow[1];
  return cashflow.filter((point, index) => index === 0 || index === last || point === lowest || point === middle);
}

/** What's left each month at each stage, in words. A striped bar means money is short. */
export default function MoneyStages({ cashflow }: MoneyStagesProps) {
  if (!cashflow || cashflow.length === 0) return null;

  const stages = pickStages(cashflow);
  const scale = Math.max(...stages.map((point) => Math.abs(point.amount)), 1);

  return (
    <ol
      className="grid gap-4 sm:gap-6"
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((point, index) => {
        const short = point.amount < 0;
        return (
          <motion.li
            key={`${point.phase}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.15 + index * 0.12 }}
          >
            <p className="truncate text-[14px] text-[var(--pf-text-secondary)]">{point.phase}</p>
            <p className="mt-1 font-serif text-[clamp(22px,3.6vh,36px)] leading-none">{formatMoney(Math.abs(point.amount))}</p>
            <p className="mt-1 text-[13px] sm:text-[14px]" style={{ color: short ? "var(--pf-warn)" : "var(--pf-good)" }}>{short ? "short a month" : "left a month"}</p>
            <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--pf-bg-dark)]">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  width: `${Math.max(3, (Math.abs(point.amount) / scale) * 100)}%`,
                  background: short ? "var(--pf-warn)" : "var(--pf-good)",
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.8, delay: 0.25 + index * 0.12 }}
              />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
