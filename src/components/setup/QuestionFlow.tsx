'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Budget } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { answersFromBudget, EMPTY_ANSWERS, profileFromAnswers, profileFromConnection } from '@/lib/quick-profile';
import type { QuickAnswers } from '@/lib/quick-profile';
import { playSound } from '@/lib/sounds';
import type { FinancialProfile } from '@/lib/types';
import AmountInput from '@/components/ui/AmountInput';

interface QuestionFlowProps {
  event: string;
  /** When connected, only what a statement can't show gets asked. */
  connected?: Budget | null;
  onDone: (profile: FinancialProfile) => void;
  onBack: () => void;
}

type AmountKey = 'income' | 'housingCost' | 'otherSpending' | 'cash' | 'creditCard';

interface Question {
  key: AmountKey | 'investments';
  ask: string;
  why: string;
  picks?: number[];
  /** Label for a zero answer, when "none" is a real and common answer. */
  noneLabel?: string;
}

const QUESTIONS: Question[] = [
  { key: 'income', ask: 'What do you earn in a year?', why: 'Before tax. I use it to work out your take-home pay.', picks: [40_000, 60_000, 80_000, 100_000, 150_000] },
  { key: 'housingCost', ask: 'What does housing cost each month?', why: 'Rent, or your mortgage payment.', picks: [1000, 1500, 2000, 2500, 3000] },
  { key: 'otherSpending', ask: 'What else do you spend each month?', why: 'Food, bills, fun, loan payments. A rough number is fine.', picks: [1000, 1500, 2000, 3000, 4000] },
  { key: 'cash', ask: 'How much cash do you have?', why: 'Chequing and savings together.', picks: [2_000, 5_000, 10_000, 25_000, 50_000] },
  { key: 'investments', ask: 'What have you invested?', why: 'Skip any you don’t have.' },
  { key: 'creditCard', ask: 'Anything owing on credit cards?', why: 'I’ll deal with this first. Card interest is expensive.', picks: [1000, 2500, 5000, 10_000], noneLabel: 'Nothing' },
];

function shortMoney(value: number): string {
  return value >= 1000 ? `$${value / 1000}k` : formatMoney(value);
}

const STILL_NEEDED: Question['key'][] = ['cash', 'investments'];

export default function QuestionFlow({ event, connected, onDone, onBack }: QuestionFlowProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuickAnswers>(() => (connected ? answersFromBudget(connected) : EMPTY_ANSWERS));
  const questions = connected ? QUESTIONS.filter((item) => STILL_NEEDED.includes(item.key)) : QUESTIONS;
  const [showPartner, setShowPartner] = useState(false);
  const advanceTimer = useRef<number | undefined>(undefined);
  const question = questions[index];

  const set = useCallback((patch: Partial<QuickAnswers>) => {
    setAnswers((current) => ({ ...current, ...patch }));
  }, []);

  const next = useCallback((latest: QuickAnswers) => {
    if (index === questions.length - 1) {
      onDone(connected ? profileFromConnection(latest, connected) : profileFromAnswers(latest));
      return;
    }
    playSound('next');
    setIndex(index + 1);
  }, [index, onDone, questions, connected]);

  const back = () => {
    playSound('tap');
    if (index === 0) onBack();
    else setIndex(index - 1);
  };

  const pick = (key: AmountKey, value: number) => {
    const latest = { ...answers, [key]: value };
    setAnswers(latest);
    playSound('tap');
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => next(latest), 170);
  };

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Enter' || (keyEvent.target as HTMLElement).tagName === 'BUTTON') return;
      keyEvent.preventDefault();
      next(answers);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answers, next]);

  return (
    <div className="mx-auto flex h-full max-w-[640px] flex-col">
      <div aria-hidden className="h-[2px] w-full bg-[var(--pf-bg-dark)]">
        <motion.div
          className="h-full bg-[var(--pf-text-primary)]"
          initial={false}
          animate={{ width: `${((index + 1) / questions.length) * 100}%` }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
        />
      </div>
      <p className="mt-4 truncate text-[14px] text-[var(--pf-text-tertiary)]">
        {connected ? "Got your spending. Just one more thing." : `Planning for: ${event}`}
      </p>

      <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={question.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { type: 'spring', bounce: 0, duration: 0.32 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
          >
            <h1 className="pf-title-lg font-serif">{question.ask}</h1>
            <p className="mt-2 text-[17px] text-[var(--pf-text-secondary)]">{question.why}</p>

            <div className="mt-[clamp(16px,4vh,36px)]">
              {question.key === 'investments' ? (
                <div className="flex flex-col gap-5">
                  <AmountInput size="md" label="TFSA" value={answers.tfsa} onChange={(tfsa) => set({ tfsa })} autoFocus />
                  <AmountInput size="md" label="RRSP" value={answers.rrsp} onChange={(rrsp) => set({ rrsp })} />
                  <AmountInput size="md" label="FHSA" value={answers.fhsa} onChange={(fhsa) => set({ fhsa })} />
                </div>
              ) : (
                <AmountInput
                  label={question.ask}
                  hideLabel
                  value={answers[question.key]}
                  onChange={(value) => set({ [question.key]: value })}
                  autoFocus
                />
              )}

              {question.key === 'housingCost' && (
                <div className="mt-5 flex gap-2">
                  {(['rent', 'own'] as const).map((housingType) => (
                    <button
                      key={housingType}
                      type="button"
                      className="pf-pill"
                      aria-pressed={answers.housingType === housingType}
                      onClick={() => {
                        set({ housingType });
                        playSound('tap');
                      }}
                    >
                      {housingType === 'rent' ? 'I rent' : 'I own'}
                    </button>
                  ))}
                </div>
              )}

              {question.picks && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {question.noneLabel && (
                    <button type="button" className="pf-pill" onClick={() => pick(question.key as AmountKey, 0)}>{question.noneLabel}</button>
                  )}
                  {question.picks.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="pf-pill"
                      aria-pressed={answers[question.key as AmountKey] === value}
                      onClick={() => pick(question.key as AmountKey, value)}
                    >
                      {shortMoney(value)}
                    </button>
                  ))}
                </div>
              )}

              {question.key === 'income' && (
                <div className="mt-5">
                  {showPartner ? (
                    <AmountInput size="md" label="Partner's income" value={answers.partnerIncome} onChange={(partnerIncome) => set({ partnerIncome })} />
                  ) : (
                    <button type="button" className="pf-link" onClick={() => setShowPartner(true)}>Add a partner&rsquo;s income</button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center justify-between">
        <button type="button" className="pf-link" onClick={back}>Back</button>
        <button type="button" className="pf-btn pf-btn-primary" onClick={() => next(answers)}>
          {index === questions.length - 1 ? 'Make my plan' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
