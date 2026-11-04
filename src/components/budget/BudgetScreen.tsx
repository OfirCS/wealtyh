'use client';

import { useState } from 'react';
import { emptyBudget, importStatement } from '@/lib/budget';
import type { Budget, ImportSummary, TransactionSource } from '@/lib/budget';
import { sampleStatement } from '@/lib/sample-statement';
import { parseStatement } from '@/lib/statement';
import type { CustomFund, FinancialProfile } from '@/lib/types';
import type { AgentStep } from '@/components/ui/AgentSteps';
import { budgetFromProfile } from '@/lib/budget';
import BudgetView from './BudgetView';

interface BudgetScreenProps {
  budget: Budget | null;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  hasNumbers: boolean;
  report: ImportSummary | null;
  fillKey: number;
  month: string;
  steps: AgentStep[] | null;
  problem: string | null;
  onMonthChange: (month: string) => void;
  onChange: (budget: Budget | null) => void;
  onAddFile: (file: File, source?: TransactionSource) => void;
  onUpdateProfile: (profile: FinancialProfile) => void;
}

export function buildSampleBudget(): Budget {
  return importStatement(parseStatement(sampleStatement(new Date())), null, 0).budget;
}

export default function BudgetScreen({
  budget,
  profile,
  customFunds,
  hasNumbers,
  report,
  fillKey,
  month,
  steps,
  problem,
  onMonthChange,
  onChange,
  onAddFile,
  onUpdateProfile,
}: BudgetScreenProps) {
  const [sample, setSample] = useState<Budget>(() => buildSampleBudget());
  const isSample = budget === null;

  return (
    <BudgetView
      budget={budget ?? sample}
      isSample={isSample}
      report={report}
      fillKey={fillKey}
      month={month}
      profile={profile}
      hasNumbers={hasNumbers}
      problem={problem}
      steps={steps}
      onMonthChange={onMonthChange}
      onChange={(next) => (isSample ? setSample(next) : onChange(next))}
      onAddFile={onAddFile}
      onFromNumbers={hasNumbers ? () => onChange(budgetFromProfile(profile, customFunds)) : undefined}
      onUpdateProfile={onUpdateProfile}
      onStartOver={() => onChange(emptyBudget())}
    />
  );
}
