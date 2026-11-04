import { useCallback, useState } from 'react';
import { defaultMonth, importStatement } from './budget';
import type { Budget, ImportSummary, TransactionSource } from './budget';
import { readFileWithAgent, readTextWithAgent } from './budget-agent';
import { formatMoney } from './money';
import { playSound } from './sounds';
import { parseStatement, StatementError } from './statement';
import type { StatementRow } from './statement';
import type { AgentStep } from '@/components/ui/AgentSteps';

const STEP_PAUSE_MS = 420;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function isCsv(file: File): boolean {
  return /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv';
}

interface ImportOptions {
  budget: Budget | null;
  fallbackIncome: number;
  onImported: (budget: Budget, summary: ImportSummary, month: string) => void;
}

/** Everything the agent does to turn a file, picture or pasted text into budget rows. */
export function useBudgetImport({ budget, fallbackIncome, onImported }: ImportOptions) {
  const [steps, setSteps] = useState<AgentStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fillSheet = useCallback(async (rows: StatementRow[], source: TransactionSource, done: AgentStep[]) => {
    const { budget: next, summary } = importStatement(rows, budget, fallbackIncome, source);
    if (summary.count === 0) {
      setSteps(null);
      setError('I already have everything in that file.');
      return;
    }

    const plan = [
      { id: 'sort', label: 'Sorting your spending', detail: summary.unsure > 0 ? `${summary.sorted} sorted, ${summary.unsure} to check` : `${summary.sorted} sorted` },
      { id: 'bills', label: 'Finding regular bills', detail: `${summary.regularBills} found` },
      { id: 'fill', label: 'Filling in your sheet', detail: `${formatMoney(summary.monthlySpend)} a month` },
    ];

    const finished = [...done];
    for (const step of plan) {
      setSteps([...finished, { id: step.id, label: step.label, status: 'active' }]);
      await wait(STEP_PAUSE_MS);
      finished.push({ ...step, status: 'complete' });
      playSound('tap');
      setSteps([...finished]);
    }
    await wait(STEP_PAUSE_MS);

    playSound('complete');
    setSteps(null);
    onImported(next, summary, defaultMonth(next, new Date()));
  }, [budget, fallbackIncome, onImported]);

  const importCsv = useCallback(async (text: string) => {
    setError(null);
    let rows: StatementRow[];
    try {
      rows = parseStatement(text);
    } catch (problem) {
      setError(problem instanceof StatementError ? problem.message : "I couldn't read that file.");
      return;
    }
    await fillSheet(rows, 'statement', [{
      id: 'read',
      label: 'Read your statement',
      status: 'complete',
      detail: `${rows.length} transactions, ${shortDate(rows[0].date)} to ${shortDate(rows[rows.length - 1].date)}`,
    }]);
  }, [fillSheet]);

  const readWithAgent = useCallback(async (label: string, source: TransactionSource, read: () => Promise<StatementRow[]>) => {
    setError(null);
    setSteps([{ id: 'read', label, status: 'active' }]);
    try {
      const rows = await read();
      if (rows.length === 0) {
        setSteps(null);
        setError("I couldn't find any purchases in that.");
        return;
      }
      playSound('tap');
      await fillSheet(rows, source, [{ id: 'read', label: 'Read it', status: 'complete', detail: `${rows.length} found` }]);
    } catch (problem) {
      setSteps(null);
      setError(problem instanceof StatementError ? problem.message : "I couldn't read that one. Try again.");
    }
  }, [fillSheet]);

  const addFile = useCallback(async (file: File, source: TransactionSource = 'agent') => {
    if (/\.(xlsx?|ofx|qfx|numbers)$/i.test(file.name)) {
      setError(`I can't open ${file.name.split('.').pop()?.toUpperCase()} files yet. Try a CSV, PDF or screenshot.`);
      return;
    }
    if (isCsv(file)) {
      await importCsv(await file.text());
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    await readWithAgent(isPdf ? 'Reading your PDF' : 'Reading your picture', source, () => readFileWithAgent(file));
  }, [importCsv, readWithAgent]);

  const addText = useCallback((text: string) => {
    void readWithAgent('Reading what you pasted', 'mail', () => readTextWithAgent(text));
  }, [readWithAgent]);

  return { steps, error, addFile, addText, importCsv };
}
