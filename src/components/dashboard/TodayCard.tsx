'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { agentInsights } from '@/lib/agent-insights';
import type { Insight } from '@/lib/agent-insights';
import type { Budget } from '@/lib/budget';
import type { Session } from '@/lib/session';
import { playSound } from '@/lib/sounds';
import AgentLight from '@/components/ui/AgentLight';
import AmountInput from '@/components/ui/AmountInput';
import Sheet from '@/components/ui/Sheet';

const SAMPLE_NOTE: Insight = { id: 'connect', title: 'Sample family. Connect Gmail to see yours.', detail: '', action: 'connect', label: 'Connect' };

interface TodayCardProps {
  session: Session;
  budget: Budget | null;
  month: string;
  working: boolean;
  isSample: boolean;
  onChoose: (insight: Insight) => void;
  onSetIncome: (income: number) => void;
}

/** One line from the agent: the most useful thing right now, and one button to deal with it. */
export default function TodayCard({ session, budget, month, working, isSample, onChoose, onSetIncome }: TodayCardProps) {
  const [askingIncome, setAskingIncome] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [income, setIncome] = useState(0);

  const insights = useMemo(() => (isSample ? [SAMPLE_NOTE] : agentInsights(budget, month).filter((insight) => insight.id !== 'bank' || session.kind === 'google')), [budget, isSample, month, session.kind]);
  const first = insights[0];
  const rest = insights.length - 1;

  const choose = (insight: Insight) => {
    setShowAll(false);
    if (insight.action === 'income') {
      setAskingIncome(true);
      return;
    }
    onChoose(insight);
  };

  // With nothing in the budget yet, the page itself is asking
  if (!isSample && !budget?.transactions.length) return null;

  return (
    <section className="flex min-h-11 items-center gap-2 lg:min-h-10">
      <h2 className="sr-only">Today</h2>
      <AgentLight working={working} />
      {first ? (
        <>
          <button type="button" onClick={() => { setShowAll(true); playSound('tap'); }} className="min-w-0 cursor-pointer text-left text-[15px] leading-tight">{first.title}</button>
          <button type="button" onClick={() => choose(first)} className="pf-btn pf-btn-agent h-8 shrink-0 px-3 text-[13px]">{first.label}</button>
          {rest > 0 && (
            <button type="button" aria-label={`${rest} more`} onClick={() => { setShowAll(true); playSound('tap'); }} className="ml-auto shrink-0 cursor-pointer text-[13px] text-[var(--pf-text-tertiary)] hover:text-[var(--pf-text-primary)]">
              <span className="hidden lg:inline">{rest} more</span>
              <span className="lg:hidden">+{rest}</span>
            </button>
          )}
        </>
      ) : (
        <span className="text-[15px] text-[var(--pf-text-tertiary)]">Nothing needs you</span>
      )}

      <AnimatePresence>
        {showAll && (
          <Sheet title="Today" onClose={() => setShowAll(false)}>
            <ul>
              {insights.map((insight) => (
                <li key={insight.id} className="relative flex min-h-14 items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[15px]">{insight.title}</span>
                    {insight.detail && <span className="block text-[13px] text-[var(--pf-text-tertiary)]">{insight.detail}</span>}
                  </span>
                  <button type="button" onClick={() => choose(insight)} className="shrink-0 cursor-pointer text-[15px] font-bold">{insight.label}</button>
                  <span aria-hidden className="pf-rule pf-rule-flat" />
                </li>
              ))}
            </ul>
          </Sheet>
        )}
        {askingIncome && (
          <Sheet title="One quick question" onClose={() => setAskingIncome(false)}>
            <p className="pf-title">What comes in each month?</p>
            <p className="mt-1 text-[15px] text-[var(--pf-text-secondary)]">After tax</p>
            <div className="mt-4"><AmountInput label="Money in each month" value={income} onChange={setIncome} hideLabel autoFocus /></div>
            <button type="button" disabled={income <= 0} className="pf-btn pf-btn-primary mt-4 h-12 w-full" onClick={() => { onSetIncome(income); setAskingIncome(false); playSound('success'); }}>Save</button>
          </Sheet>
        )}
      </AnimatePresence>
    </section>
  );
}
