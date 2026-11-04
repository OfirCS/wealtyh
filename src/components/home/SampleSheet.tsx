'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { defaultMonth, importStatement, monthLabel, monthSummary } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { sampleStatement } from '@/lib/sample-statement';
import { parseStatement } from '@/lib/statement';

const ROWS = 6;

/** Shows what a filled-in budget looks like before anything is connected. */
export default function SampleSheet({ onOpen }: { onOpen: () => void }) {
  const sheet = useMemo(() => {
    const today = new Date();
    const { budget } = importStatement(parseStatement(sampleStatement(today)), null, 0);
    const month = defaultMonth(budget, today);
    const summary = monthSummary(budget, month);
    return {
      month,
      left: summary.left,
      rows: [...budget.categories]
        .sort((a, b) => b.planned - a.planned)
        .slice(0, ROWS)
        .map((category) => ({ ...category, spent: summary.spentByCategory[category.id] ?? 0 })),
    };
  }, []);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label="Open the sample budget"
      initial={{ opacity: 0, y: 18, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', bounce: 0.1, duration: 0.8, delay: 0.15 }}
      className="hidden w-full cursor-pointer overflow-hidden rounded-[18px] border border-[var(--pf-border)] bg-[var(--pf-bg-primary)] text-left shadow-[0_18px_40px_rgba(0,0,0,0.08)] lg:block"
    >
      <div className="flex items-baseline justify-between border-b border-[var(--pf-border)] p-4">
        <span>
          <span className="block text-[13px] text-[var(--pf-text-tertiary)]">Sample family · {monthLabel(sheet.month)}</span>
          <span className="font-serif text-[34px] leading-tight">{formatMoney(sheet.left)}</span>
          <span className="ml-2 text-[14px] text-[var(--pf-text-secondary)]">left to spend</span>
        </span>
      </div>
      <table className="w-full table-fixed border-collapse text-[14px]">
        <thead>
          <tr className="bg-[var(--pf-bg-elevated)] text-left">
            <th className="w-[46%] px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 text-right font-semibold">Budget</th>
            <th className="px-3 py-2 text-right font-semibold">Spent</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, index) => (
            <motion.tr key={row.id} className="border-t border-[var(--pf-border)]" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + index * 0.08 }}>
              <td className="truncate px-3 py-2">{row.name}</td>
              <td className="px-3 py-2 text-right">{Math.round(row.planned).toLocaleString('en-CA')}</td>
              <td className="px-3 py-2 text-right">{Math.round(row.spent).toLocaleString('en-CA')}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--pf-border)] p-3 text-[14px] font-medium">See it on your board →</p>
    </motion.button>
  );
}
