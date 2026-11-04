'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tidyName } from '@/lib/agent-insights';
import { categorize, categoryName } from '@/lib/budget';
import type { Budget } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { DEMO_SESSION } from '@/lib/session';
import type { Session } from '@/lib/session';
import { useBudgetImport } from '@/lib/use-budget-import';
import CategoryIcon from '@/components/budget/CategoryIcon';
import { LogoMark } from '@/components/ui/Logo';

interface AgentRunProps {
  mode: 'google' | 'demo';
  onDone: (budget: Budget | null, session: Session) => void;
  onFailed: (problem: string) => void;
}

const VISIBLE_ROWS = 7;
const REVEAL_MS = 170;
const FINISH_PAUSE_MS = 1100;

/** The moment the product is about: the screen fills up while you watch. */
export default function AgentRun({ mode, onDone, onFailed }: AgentRunProps) {
  const [revealed, setRevealed] = useState(0);
  const [finished, setFinished] = useState<Budget | null>(null);
  const [user, setUser] = useState<Session>(DEMO_SESSION);
  const started = useRef(false);

  const onImported = useCallback((budget: Budget) => setFinished(budget), []);
  const onUser = useCallback((next: { name: string; email: string }) => {
    setUser({ ...next, kind: 'google' });
  }, []);

  const { steps, error, found, connectGmail, runDemo } = useBudgetImport({ budget: null, fallbackIncome: 0, onImported, onUser });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (mode === 'demo' ? runDemo() : connectGmail());
  }, [mode, runDemo, connectGmail]);

  useEffect(() => {
    if (found.length === 0) return;
    const timer = window.setInterval(() => setRevealed((value) => Math.min(found.length, value + 1)), REVEAL_MS);
    return () => window.clearInterval(timer);
  }, [found.length]);

  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => onDone(finished, user), FINISH_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [finished, onDone, user]);

  const spent = found.slice(0, revealed).reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const rows = found.slice(Math.max(0, revealed - VISIBLE_ROWS), revealed).reverse();

  return (
    <div className="relative flex h-[100dvh] items-center overflow-hidden bg-[var(--pf-ink)] text-[var(--pf-ivory)]">
      <div aria-hidden className="pf-grid-dark pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-x-16 gap-y-6 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <span className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pf-agent)] text-[var(--pf-ink)] ${finished ? '' : 'pf-pulse'}`}><LogoMark size={26} /></span>
          <h1 className="pf-title-xl mt-5 font-serif">{finished ? 'Your budget is ready.' : 'Your agent is working.'}</h1>
          {mode === 'demo' && <p className="mt-2 text-[15px] text-[var(--pf-ivory-dim)]">Demo account, using a made-up family.</p>}

          <ol className="mt-[clamp(14px,3vh,28px)] flex flex-col gap-2.5" aria-live="polite">
            <AnimatePresence initial={false}>
              {(steps ?? []).map((step) => (
                <motion.li key={step.id} className="flex items-baseline gap-3 text-[17px]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <span aria-hidden className="flex w-4 shrink-0 justify-center">
                    {step.status === 'complete'
                      ? <span className="text-[var(--pf-agent)]">✓</span>
                      : <span className="pf-pulse inline-block h-2 w-2 rounded-full bg-[var(--pf-agent)]" />}
                  </span>
                  <span className={`shrink-0 ${step.status === 'complete' ? 'text-[var(--pf-ivory-dim)]' : ''}`}>{step.label}</span>
                  {step.detail && <span className="min-w-0 truncate text-[14px] text-[var(--pf-ivory-dim)]">{step.detail}</span>}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>

          {error && (
            <div className="mt-5">
              <p className="text-[17px]" role="alert">{error}</p>
              <button type="button" className="pf-btn pf-btn-agent mt-3" onClick={() => (user.kind === 'google' ? onDone(null, user) : onFailed(error))}>
                {user.kind === 'google' ? 'Go to my dashboard' : 'Go back'}
              </button>
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-[24px] bg-[var(--pf-ivory)] text-[var(--pf-ink)] shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:block">
          <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
            <span className="text-[14px] font-semibold">{revealed > 0 ? `${revealed} purchases found` : 'Searching your inbox…'}</span>
            <span className="font-serif text-[26px] leading-none tabular-nums">{formatMoney(spent)}</span>
          </div>
          <ul className="mx-3 mb-3 h-[clamp(224px,44vh,336px)] overflow-hidden rounded-[16px] bg-white">
            {rows.length === 0 && Array.from({ length: VISIBLE_ROWS }, (_, index) => (
              <li key={index} className="flex h-[48px] items-center gap-3 border-b border-[var(--pf-border)] px-3.5 last:border-b-0">
                <motion.span
                  className="flex w-full items-center gap-3"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.09 }}
                >
                  <span className="h-7 w-7 shrink-0 rounded-full bg-[var(--pf-bg-elevated)]" />
                  <span className="h-2.5 flex-1 rounded-full bg-[var(--pf-bg-elevated)]" />
                  <span className="h-2.5 w-14 shrink-0 rounded-full bg-[var(--pf-bg-elevated)]" />
                </motion.span>
              </li>
            ))}
            <AnimatePresence initial={false}>
              {rows.map((row) => {
                const { categoryId } = categorize(row.description);
                return (
                  <motion.li
                    key={`${row.date}-${row.description}-${row.amount}`}
                    layout
                    initial={{ opacity: 0, y: -14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    className="flex h-[48px] items-center gap-3 border-b border-[var(--pf-border)] px-3.5 text-[14px] last:border-b-0"
                  >
                    <CategoryIcon id={categoryId} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{tidyName(row.description)}</span>
                      <span className="block truncate text-[12px] text-[var(--pf-text-tertiary)]">{categoryName(categoryId)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(row.amount)}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}
