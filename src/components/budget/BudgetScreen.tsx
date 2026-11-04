'use client';

import { useCallback, useMemo, useState } from 'react';
import { budgetFromProfile, defaultMonth, emptyBudget, importStatement } from '@/lib/budget';
import type { Budget, ImportSummary } from '@/lib/budget';
import { getMoneyPicture } from '@/lib/money';
import { sampleStatement } from '@/lib/sample-statement';
import { parseStatement } from '@/lib/statement';
import type { CustomFund, FinancialProfile } from '@/lib/types';
import { useBudgetImport } from '@/lib/use-budget-import';
import BudgetView from './BudgetView';

interface BudgetScreenProps {
  budget: Budget | null;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  hasNumbers: boolean;
  onChange: (budget: Budget | null) => void;
  onUpdateProfile: (profile: FinancialProfile) => void;
}

export function buildSampleBudget(): Budget {
  return importStatement(parseStatement(sampleStatement(new Date())), null, 0).budget;
}

export default function BudgetScreen({ budget, profile, customFunds, hasNumbers, onChange, onUpdateProfile }: BudgetScreenProps) {
  const [report, setReport] = useState<ImportSummary | null>(null);
  const [fillKey, setFillKey] = useState(0);
  const [sample, setSample] = useState<Budget>(() => buildSampleBudget());
  const isSample = budget === null;
  const shown = budget ?? sample;
  const [month, setMonth] = useState<string>(() => defaultMonth(shown, new Date()));

  const fallbackIncome = hasNumbers ? getMoneyPicture(profile, customFunds).monthlyTakeHome : 0;

  const onImported = useCallback((next: Budget, summary: ImportSummary, nextMonth: string) => {
    onChange(next);
    setMonth(nextMonth);
    setReport(summary);
    setFillKey((key) => key + 1);
  }, [onChange]);

  const { steps, error, addFile, addText } = useBudgetImport({ budget, fallbackIncome, onImported });

  const fromNumbers = useMemo(
    () => (hasNumbers ? () => onChange(budgetFromProfile(profile, customFunds)) : undefined),
    [hasNumbers, onChange, profile, customFunds],
  );

  return (
    <BudgetView
      budget={shown}
      isSample={isSample}
      report={report}
      fillKey={fillKey}
      month={month}
      profile={profile}
      hasNumbers={hasNumbers}
      problem={error}
      steps={steps}
      onMonthChange={setMonth}
      onChange={(next) => (isSample ? setSample(next) : onChange(next))}
      onAddFile={addFile}
      onAddText={addText}
      onFromNumbers={fromNumbers}
      onUpdateProfile={onUpdateProfile}
      onStartOver={() => {
        setReport(null);
        setFillKey(0);
        setSample(buildSampleBudget());
        setMonth(defaultMonth(emptyBudget(), new Date()));
        onChange(null);
      }}
    />
  );
}
