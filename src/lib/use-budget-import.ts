import { useCallback, useState } from 'react';
import { defaultMonth, importStatement } from './budget';
import type { Budget, ImportSummary, TransactionSource } from './budget';
import { readEmailsWithAgent, readPdfWithAgent } from './budget-agent';
import { fetchGoogleUser, findReceiptEmails, GmailError, lastGmailCheck, readEmails, rememberGmailCheck, requestGmailAccess } from './gmail';
import { formatMoney } from './money';
import { playSound } from './sounds';
import { sampleStatement } from './sample-statement';
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
  onUser?: (user: { name: string; email: string }) => void;
}

/** Everything the agent does to turn an inbox or a statement into budget rows. */
export function useBudgetImport({ budget, fallbackIncome, onImported, onUser }: ImportOptions) {
  const [steps, setSteps] = useState<AgentStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<StatementRow[]>([]);

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
    if (isCsv(file)) {
      await importCsv(await file.text());
      return;
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      await readWithAgent('Reading your statement', source, () => readPdfWithAgent(file));
      return;
    }
    setError("I can read CSV and PDF statements. Try downloading one of those from your bank.");
  }, [importCsv, readWithAgent]);

  const connectGmail = useCallback(async () => {
    setError(null);
    const started = Date.now();
    const finished: AgentStep[] = [];
    const show = (step: AgentStep) => setSteps([...finished, step]);
    const complete = (step: AgentStep) => {
      finished.push(step);
      playSound('tap');
      setSteps([...finished]);
    };

    try {
      show({ id: 'google', label: 'Connecting to Gmail', status: 'active' });
      const token = await requestGmailAccess();
      onUser?.(await fetchGoogleUser(token));
      complete({ id: 'google', label: 'Connected to Gmail', status: 'complete' });

      const since = lastGmailCheck();
      show({ id: 'search', label: 'Looking through your inbox', status: 'active' });
      const ids = await findReceiptEmails(token, since);
      if (ids.length === 0) {
        rememberGmailCheck(started);
        setSteps(null);
        setError(since ? "You're all caught up. Nothing new since I last looked." : "I looked, but didn't find any receipts or bank alerts in the last 90 days.");
        return;
      }
      complete({ id: 'search', label: 'Looked through your inbox', status: 'complete', detail: `${ids.length} emails about money` });

      show({ id: 'read', label: 'Reading your receipts', status: 'active', detail: `0 of ${ids.length}` });
      const emails = await readEmails(token, ids, (done) => {
        show({ id: 'read', label: 'Reading your receipts', status: 'active', detail: `${done} of ${ids.length}` });
      });
      show({ id: 'read', label: 'Picking out your purchases', status: 'active' });
      const rows = await readEmailsWithAgent(emails);
      if (rows.length === 0) {
        rememberGmailCheck(started);
        setSteps(null);
        setError("I read those emails, but none of them were real purchases.");
        return;
      }
      complete({ id: 'read', label: 'Read your receipts', status: 'complete', detail: `${rows.length} purchases found` });
      setFound(rows.filter((row) => row.amount > 0));

      rememberGmailCheck(started);
      await fillSheet(rows, 'mail', finished);
    } catch (problem) {
      setSteps(null);
      const friendly = problem instanceof GmailError || problem instanceof StatementError;
      setError(friendly ? problem.message : 'Something went wrong while reading your email. Try again in a moment.');
    }
  }, [fillSheet, onUser]);

  /** The same run with a made-up family's money, so anyone can see the whole flow. */
  const runDemo = useCallback(async () => {
    const rows = parseStatement(sampleStatement(new Date()));
    const spending = rows.filter((row) => row.amount > 0);
    const finished: AgentStep[] = [];
    const step = async (id: string, active: string, done: string, detail: string) => {
      setSteps([...finished, { id, label: active, status: 'active' }]);
      await wait(STEP_PAUSE_MS * 1.5);
      finished.push({ id, label: done, status: 'complete', detail });
      playSound('tap');
      setSteps([...finished]);
    };

    await step('google', 'Opening the demo inbox', 'Opened the demo inbox', '');
    await step('search', 'Looking through the inbox', 'Looked through the inbox', `${rows.length} emails about money`);
    setFound(spending);
    await step('read', 'Reading the receipts', 'Read the receipts', `${spending.length} purchases found`);
    await fillSheet(rows, 'mail', finished);
  }, [fillSheet]);

  return { steps, error, found, addFile, connectGmail, runDemo, importCsv };
}
