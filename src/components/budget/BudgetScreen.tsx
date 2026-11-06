'use client';

import { useCallback, useState } from 'react';
import { emptyBudget, importStatement } from '@/lib/budget';
import type { Budget, TransactionSource } from '@/lib/budget';
import { sampleStatement } from '@/lib/sample-statement';
import { parseStatement } from '@/lib/statement';
import type { CustomFund, FinancialProfile } from '@/lib/types';
import type { View } from '@/components/app/AppShell';
import type { AgentStep } from '@/components/ui/AgentSteps';
import { budgetFromProfile } from '@/lib/budget';
import BudgetView from './BudgetView';
import type { BudgetActions } from './BudgetView';

interface BudgetScreenProps {
  budget: Budget | null;
  greeting: string;
  game: (actions: BudgetActions) => React.ReactNode;
  today: (actions: BudgetActions, isSample: boolean) => React.ReactNode;
  view: View;
  onView: (view: View) => void;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  hasNumbers: boolean;
  fillKey: number;
  month: string;
  steps: AgentStep[] | null;
  problem: string | null;
  openOnArrival?: string | null;
  reviewOnArrival?: boolean;
  onMonthChange: (month: string) => void;
  onChange: (budget: Budget | null) => void;
  onAddFile: (file: File, source?: TransactionSource) => void;
  onUpdateProfile: (profile: FinancialProfile) => void;
  onConnect: () => void;
}

const UNDO_STEPS = 30;

export function buildSampleBudget(): Budget {
  return importStatement(parseStatement(sampleStatement(new Date())), null, 0).budget;
}

export default function BudgetScreen({
  budget,
  greeting,
  game,
  today,
  view,
  onView,
  profile,
  customFunds,
  hasNumbers,
  fillKey,
  month,
  steps,
  problem,
  openOnArrival,
  reviewOnArrival,
  onMonthChange,
  onChange,
  onAddFile,
  onUpdateProfile,
  onConnect,
}: BudgetScreenProps) {
  const [sample, setSample] = useState<Budget>(() => buildSampleBudget());
  const [past, setPast] = useState<Budget[]>([]);
  const isSample = budget === null;
  const current = budget ?? sample;

  // Undo can't step back over a check-in or an import, or it would throw them away
  const [applied, setApplied] = useState(budget);
  if (budget !== applied) {
    setApplied(budget);
    setPast([]);
  }

  const apply = useCallback((next: Budget) => {
    if (isSample) {
      setSample(next);
      return;
    }
    setApplied(next);
    onChange(next);
  }, [isSample, onChange]);

  const change = useCallback((next: Budget) => {
    setPast((history) => [...history.slice(1 - UNDO_STEPS), current]);
    apply(next);
  }, [apply, current]);

  const undo = useCallback(() => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((history) => history.slice(0, -1));
    apply(previous);
  }, [apply, past]);

  return (
    <BudgetView
      budget={current}
      greeting={greeting}
      game={game}
      today={today}
      isSample={isSample}
      view={view}
      onView={onView}
      fillKey={fillKey}
      month={month}
      profile={profile}
      hasNumbers={hasNumbers}
      problem={problem}
      steps={steps}
      canUndo={past.length > 0}
      openOnArrival={openOnArrival}
      reviewOnArrival={reviewOnArrival}
      onUndo={undo}
      onMonthChange={onMonthChange}
      onChange={change}
      onAddFile={onAddFile}
      onFromNumbers={hasNumbers ? () => onChange(budgetFromProfile(profile, customFunds)) : undefined}
      onUpdateProfile={onUpdateProfile}
      onStartOver={() => onChange(emptyBudget())}
      onConnect={onConnect}
    />
  );
}
