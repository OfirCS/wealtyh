'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogoMark } from '@/components/ui/Logo';

// An illustration of what the agent does, played on a loop for the landing page
const ROWS: { name: string; category: string; amount: string }[] = [
  { name: 'Costco', category: 'Groceries', amount: '$318.12' },
  { name: 'Rogers', category: 'Bills', amount: '$118.50' },
  { name: 'Daycare', category: 'Kids', amount: '$640.00' },
  { name: 'Shell', category: 'Transport', amount: '$71.30' },
  { name: 'Netflix', category: 'Bills', amount: '$18.99' },
  { name: 'Metro', category: 'Groceries', amount: '$142.77' },
];

const STAGES = ['Reading your receipts', 'Sorting your spending', 'Building your budget'];
const STEP_MS = 620;
const HOLD_STEPS = 6;

export default function LiveAgent() {
  const [tick, setTick] = useState(0);
  const total = ROWS.length + HOLD_STEPS;
  const shown = Math.min(tick, ROWS.length);
  const done = tick >= ROWS.length;
  const stage = done ? 2 : tick < 3 ? 0 : 1;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setTick((value) => (value + 1) % total), STEP_MS);
    return () => window.clearInterval(timer);
  }, [total]);

  return (
    <div aria-hidden className="w-full overflow-hidden rounded-[24px] bg-[var(--pf-ivory)] text-[var(--pf-ink)] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3 bg-[var(--pf-ink-soft)] px-5 py-3.5 text-[var(--pf-ivory)]">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pf-agent)] text-[var(--pf-ink)] ${done ? '' : 'pf-pulse'}`}><LogoMark size={16} /></span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight">Your agent</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={done ? 'done' : stage} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-[13px] leading-tight text-[var(--pf-ivory-dim)]">
              {done ? 'All done. Your budget is ready.' : `${STAGES[stage]}…`}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-baseline justify-between px-1 pb-2">
          <span className="text-[13px] font-semibold">Found in your inbox</span>
          <span className="text-[13px] text-[var(--pf-text-secondary)]">{shown} of {ROWS.length}</span>
        </div>
        <ul className="h-[clamp(150px,27vh,222px)] overflow-hidden rounded-[14px] bg-white">
          {ROWS.slice(0, Math.max(1, Math.ceil(ROWS.length))).map((row, index) => (
            <li key={row.name} className="flex h-[16.66%] items-center justify-between gap-3 border-b border-[var(--pf-border)] px-3.5 text-[14px] last:border-b-0">
              {index < shown ? (
                <>
                  <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 truncate font-medium">{row.name}</motion.span>
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto rounded-full bg-[var(--pf-bg-elevated)] px-2.5 py-0.5 text-[12px]">{row.category}</motion.span>
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-[68px] text-right tabular-nums">{row.amount}</motion.span>
                </>
              ) : (
                <span className="h-2.5 w-full rounded-full bg-[var(--pf-bg-elevated)]" />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-[14px] bg-[var(--pf-ink)] px-4 py-3 text-[var(--pf-ivory)]">
          <span className="text-[14px]">Left to spend this month</span>
          <span className={`font-serif text-[24px] leading-none transition-opacity duration-300 ${done ? 'opacity-100' : 'opacity-25'}`}>$1,240</span>
        </div>
      </div>
    </div>
  );
}
