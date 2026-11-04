'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { agentInsights, upcomingBills } from '@/lib/agent-insights';
import type { Insight } from '@/lib/agent-insights';
import { monthLabel, monthSummary } from '@/lib/budget';
import type { Budget } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import type { Session } from '@/lib/session';
import CategoryIcon from '@/components/budget/CategoryIcon';
import { LogoMark } from '@/components/ui/Logo';
import { Ticking } from '@/components/ui/Ticking';

interface DashboardProps {
  session: Session;
  budget: Budget | null;
  month: string;
  onInsight: (insight: Insight) => void;
  onAsk: (question: string) => void;
  onOpenBudget: () => void;
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

function shortDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function Card({ title, action, children, className = '', delay = 0 }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      className={`pf-card flex min-h-0 flex-col overflow-hidden p-4 ${className}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.5, delay }}
    >
      <div className="flex shrink-0 items-baseline justify-between gap-3 pb-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </motion.section>
  );
}

export default function Dashboard({ session, budget, month, onInsight, onAsk, onOpenBudget }: DashboardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => (budget ? monthSummary(budget, month) : null), [budget, month]);
  const insights = useMemo(() => agentInsights(budget, month), [budget, month]);
  const bills = useMemo(() => (budget ? upcomingBills(budget, today).slice(0, 5) : []), [budget, today]);

  const categories = useMemo(() => {
    if (!budget || !summary) return [];
    return [...budget.categories]
      .map((category) => ({ ...category, spent: summary.spentByCategory[category.id] ?? 0 }))
      .filter((category) => category.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [budget, summary]);

  const left = summary?.left ?? 0;
  const used = summary && summary.planned > 0 ? Math.min(100, (summary.spent / summary.planned) * 100) : 0;
  const widest = Math.max(1, ...categories.map((category) => category.spent));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="font-serif text-[clamp(26px,4.4vh,38px)] leading-none tracking-tight">{greeting(session.name)}</h1>
        <form
          className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-full bg-[var(--pf-bg-surface)] pl-5 pr-1.5 shadow-[inset_0_0_0_1px_var(--pf-border)] lg:max-w-[460px]"
          onSubmit={(event) => {
            event.preventDefault();
            const field = event.currentTarget.elements.namedItem('ask') as HTMLInputElement;
            if (field.value.trim()) onAsk(field.value.trim());
          }}
        >
          <label htmlFor="pf-ask" className="sr-only">Ask your agent</label>
          <input id="pf-ask" name="ask" autoComplete="off" placeholder="Ask your agent anything" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--pf-text-tertiary)]" />
          <button type="submit" className="pf-btn pf-btn-primary h-8 px-3.5 text-[13px]">Ask</button>
        </form>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 md:grid-cols-2 lg:grid-rows-2">
        <motion.section
          className="flex min-h-0 flex-col justify-between gap-2 overflow-hidden rounded-[20px] bg-[var(--pf-ink)] p-5 text-[var(--pf-ivory)]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
        >
          <div className="flex items-center justify-between text-[14px] text-[var(--pf-ivory-dim)]">
            <span>{monthLabel(month)}</span>
            <button type="button" onClick={onOpenBudget} className="cursor-pointer hover:text-[var(--pf-ivory)]">Open budget →</button>
          </div>
          <div>
            <p className="font-serif text-[clamp(40px,8.4vh,72px)] leading-none tracking-tight"><Ticking value={Math.abs(left)} format={formatMoney} /></p>
            <p className="mt-1 text-[16px]">{left >= 0 ? 'left to spend' : 'over budget'}</p>
          </div>
          <div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-[var(--pf-ink-soft)]">
              <motion.div className="h-full rounded-full bg-[var(--pf-agent)]" initial={{ width: 0 }} animate={{ width: `${used}%` }} transition={{ type: 'spring', bounce: 0, duration: 1, delay: 0.2 }} />
            </div>
            <p className="mt-1.5 text-[13px] text-[var(--pf-ivory-dim)]">{formatMoney(summary?.spent ?? 0)} spent of {formatMoney(summary?.planned ?? 0)}</p>
          </div>
        </motion.section>

        <motion.section
          className="flex min-h-0 flex-col overflow-hidden rounded-[20px] bg-[var(--pf-agent)] p-4 text-[var(--pf-ink)]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5, delay: 0.06 }}
        >
          <div className="flex shrink-0 items-center gap-2.5 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--pf-ink)] text-[var(--pf-agent)]"><LogoMark size={14} /></span>
            <h2 className="text-[15px] font-semibold">Your agent</h2>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col justify-around overflow-hidden max-lg:[&>li:nth-child(n+3)]:hidden">
            {insights.map((insight) => (
              <li key={insight.id} className="flex items-center justify-between gap-3 border-t border-black/10 py-1.5 first:border-t-0">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold leading-tight">{insight.title}</span>
                  <span className="block truncate text-[13px] leading-snug opacity-70">{insight.detail}</span>
                </span>
                <button type="button" className="pf-btn pf-btn-primary h-8 shrink-0 px-3.5 text-[13px]" onClick={() => onInsight(insight)}>{insight.label}</button>
              </li>
            ))}
          </ul>
        </motion.section>

        <Card title="Bills coming up" delay={0.18} className="lg:order-last [@media(max-height:760px)_and_(max-width:767px)]:hidden">
          {bills.length === 0 ? (
            <p className="text-[14px] text-[var(--pf-text-secondary)]">I&rsquo;ll list these once I&rsquo;ve seen a couple of months.</p>
          ) : (
            <ul className="flex h-full flex-col justify-around">
              {bills.map((bill) => (
                <li key={bill.name} className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="min-w-0 truncate">{bill.name}</span>
                  <span className="shrink-0 text-[var(--pf-text-tertiary)]">{shortDay(bill.date)}</span>
                  <span className="w-[62px] shrink-0 text-right tabular-nums">{formatMoney(bill.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Where it's going" className="hidden md:flex" delay={0.12} action={<button type="button" className="pf-link text-[13px]" onClick={onOpenBudget}>See all</button>}>
          <ul className="flex h-full flex-col justify-around">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-2.5 text-[14px]">
                <CategoryIcon id={category.id} />
                <span className="w-[86px] shrink-0 truncate">{category.name}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--pf-bg-elevated)]">
                  <motion.span className="block h-full rounded-full" style={{ background: category.spent > category.planned ? 'var(--pf-warn)' : 'var(--pf-ink)' }} initial={{ width: 0 }} animate={{ width: `${(category.spent / widest) * 100}%` }} transition={{ type: 'spring', bounce: 0, duration: 0.9, delay: 0.25 }} />
                </span>
                <span className="w-[56px] shrink-0 text-right tabular-nums">{formatMoney(category.spent)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
