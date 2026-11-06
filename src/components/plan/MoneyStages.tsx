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

/** "While saving (months 1-6)" reads better as a name with a quiet note under it. */
function splitPhase(phase: string): { name: string; note: string } {
  const match = phase.match(/^(.*?)\s*\((.*)\)\s*$/);
  return match ? { name: match[1], note: match[2] } : { name: phase, note: "" };
}

function stageWord(amount: number): string {
  if (amount < 0) return "short each month";
  if (amount === 0) return "nothing left over";
  return "left each month";
}

/** What's left each month at each stage of the plan, along one line. */
export default function MoneyStages({ cashflow }: MoneyStagesProps) {
  if (!cashflow || cashflow.length === 0) return null;

  const stages = pickStages(cashflow);

  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
      {stages.map((point, index) => {
        const { name, note } = splitPhase(point.phase);
        const short = point.amount < 0;
        const empty = point.amount === 0;
        return (
          <motion.li
            key={`${point.phase}-${index}`}
            className="relative pr-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5, delay: 0.15 + index * 0.12 }}
          >
            <div aria-hidden className="relative mb-3 h-3">
              {index < stages.length - 1 && <span className="absolute left-3 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--pf-text-primary)]" />}
              <span className="absolute left-0 top-0 h-3 w-3 rounded-full" style={{ background: short ? "var(--pf-warn)" : empty ? "var(--pf-bg-primary)" : "var(--pf-text-primary)", boxShadow: empty ? "inset 0 0 0 2px var(--pf-text-primary)" : undefined }} />
            </div>
            <p className="text-[15px] font-medium leading-tight">{name}</p>
            <p className="min-h-[18px] text-[13px] leading-snug text-[var(--pf-text-tertiary)]">{note}</p>
            <p className="mt-1.5 font-serif text-[clamp(26px,4.2vh,40px)] leading-none tracking-tight" style={{ color: short ? "var(--pf-warn)" : undefined }}>{formatMoney(Math.abs(point.amount))}</p>
            <p className="mt-1 text-[14px] text-[var(--pf-text-secondary)]">{stageWord(point.amount)}</p>
          </motion.li>
        );
      })}
    </ol>
  );
}
