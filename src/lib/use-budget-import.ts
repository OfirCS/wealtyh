import { useCallback, useRef, useState } from 'react';
import { api, ApiProblem } from '@/client/api';
import { openPlaidLink } from '@/client/plaid-link';
import { restoreBudget } from '@/client/use-cloud-budget';
import type { Sighting } from '@/core/ledger/types';
import { autoBudget, defaultMonth, importStatement, merchantKey, mergeDeadlines, purchaseRhythms, sortTransfersToPeople } from './budget';
import type { Budget, ImportSummary, TransactionSource } from './budget';
import { judgeRhythms, readEmailsWithAgent, readImagesWithAgent, readPdfWithAgent, sortRowsWithAgent } from './budget-agent';
import { fetchGoogleUser, findReceiptEmails, GMAIL_UNTICKED, GmailError, inboxProgress, readEmails, readWalletTaps, rememberInbox, requestGmailAccess } from './gmail';
import type { GoogleAccess } from './gmail';
import { rowsFromSightings, withdrawSightings } from './ledger-adapter';
import { formatMoney } from './money';
import { playSound } from './sounds';
import { sampleStatement } from './sample-statement';
import { parseStatement, StatementError } from './statement';
import type { Deadline, StatementRow } from './statement';
import type { AgentStep } from '@/components/ui/AgentSteps';

const STEP_PAUSE_MS = 420;
/** A new bank connection takes a moment to gather its history. */
const BANK_POLL_MS = 3000;
const BANK_POLLS = 20;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(file.name);
}

function isCsv(file: File): boolean {
  return /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv';
}

interface ImportOptions {
  budget: Budget | null;
  fallbackIncome: number;
  /** Who's signed in, so Google needn't ask which account. */
  email?: string;
  onImported: (budget: Budget, summary: ImportSummary, month: string) => void;
  onUser?: (user: { name: string; email: string }) => void;
  /** A new device found this family's budget, so there's nothing to scan. */
  onRestored?: (budget: Budget) => void;
}

/** Everything the agent does to turn an inbox or a statement into budget rows. */
export function useBudgetImport({ budget, fallbackIncome, email, onImported, onUser, onRestored }: ImportOptions) {
  const [steps, setSteps] = useState<AgentStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<StatementRow[]>([]);
  const merchantRules = budget?.merchantRules;
  const latestBudget = useRef(budget);
  latestBudget.current = budget;

  const fillSheet = useCallback(async (rows: StatementRow[], source: TransactionSource, done: AgentStep[], deadlines: Deadline[] = [], stamp: (budget: Budget) => Budget = (same) => same, askAgent = true) => {
    // Bank and Gmail can run back to back, so always start from the newest budget
    const current = latestBudget.current;
    const { budget: imported, summary } = importStatement(rows, current && stamp(current), fallbackIncome, source);
    const stamped = sortTransfersToPeople(current ? imported : stamp(imported));
    let verdicts = null;
    if (askAgent && summary.count > 0) {
      setSteps([...done, { id: 'once', label: 'Looking for one-time purchases', status: 'active' }]);
      verdicts = await judgeRhythms(stamped, stamped.rhythms ? new Set(rows.map((row) => merchantKey(row.description))) : undefined);
    }
    const judged = verdicts ? { ...stamped, rhythms: { ...stamped.rhythms, ...verdicts } } : stamped;
    const next = mergeDeadlines(autoBudget(judged), deadlines);
    latestBudget.current = next;
    if (summary.count === 0 && source === 'bank') {
      onImported(next, summary, defaultMonth(next, new Date()));
      setSteps(null);
      return 0;
    }
    if (summary.count === 0) {
      if (deadlines.length > 0) onImported(next, summary, defaultMonth(next, new Date()));
      setSteps(null);
      setError('I already have everything in that file.');
      return 0;
    }

    const oneTime = [...purchaseRhythms(next).values()].filter((rhythm) => rhythm === 'once').length;
    const plan = [
      ...(summary.repeats > 0 ? [{ id: 'match', label: 'Matching purchases across sources', detail: `${summary.repeats} counted once` }] : []),
      { id: 'sort', label: 'Sorting your spending', detail: summary.unsure > 0 ? `${summary.sorted} sorted, ${summary.unsure} to check` : `${summary.sorted} sorted` },
      { id: 'bills', label: 'Finding regular bills', detail: `${summary.regularBills} found` },
      ...(oneTime > 0 ? [{ id: 'once', label: 'Setting aside one-time purchases', detail: `${oneTime} kept out of your budget` }] : []),
      { id: 'fill', label: 'Building your budget', detail: `${formatMoney(summary.monthlySpend)} a month` },
    ];

    const finished = [...done];
    for (const step of plan) {
      setSteps([...finished, { id: step.id, label: step.label, status: 'active' }]);
      await wait(STEP_PAUSE_MS);
      finished.push({ ...step, status: 'complete' });
      playSound('print');
      setSteps([...finished]);
    }
    await wait(STEP_PAUSE_MS);

    playSound('complete');
    setSteps(null);
    onImported(next, summary, defaultMonth(next, new Date()));
    return summary.count;
  }, [fallbackIncome, onImported]);

  const importCsv = useCallback(async (text: string) => {
    setError(null);
    let rows: StatementRow[];
    try {
      rows = parseStatement(text);
    } catch (problem) {
      setError(problem instanceof StatementError ? problem.message : "I couldn't read that file.");
      return;
    }
    setSteps([{ id: 'read', label: 'Sorting your statement', status: 'active' }]);
    await fillSheet(await sortRowsWithAgent(rows, merchantRules), 'statement', [{
      id: 'read',
      label: 'Read your statement',
      status: 'complete',
      detail: `${rows.length} transactions, ${shortDate(rows[0].date)} to ${shortDate(rows[rows.length - 1].date)}`,
    }]);
  }, [fillSheet, merchantRules]);

  const readWithAgent = useCallback(async (label: string, source: TransactionSource, read: () => Promise<StatementRow[]>) => {
    setError(null);
    setSteps([{ id: 'read', label, status: 'active' }]);
    try {
      const rows = await sortRowsWithAgent(await read(), merchantRules);
      if (rows.length === 0) {
        setSteps(null);
        setError("I couldn't find any purchases in that.");
        return;
      }
      playSound('print');
      await fillSheet(rows, source, [{ id: 'read', label: 'Read it', status: 'complete', detail: `${rows.length} found` }]);
    } catch (problem) {
      setSteps(null);
      setError(problem instanceof StatementError ? problem.message : "I couldn't read that one. Try again.");
    }
  }, [fillSheet, merchantRules]);

  const addFile = useCallback(async (file: File, source: TransactionSource = 'agent') => {
    if (isCsv(file)) {
      await importCsv(await file.text());
      return;
    }
    if (isImage(file)) {
      await readWithAgent('Reading your picture', source, () => readImagesWithAgent([file]));
      return;
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      await readWithAgent('Reading your statement', source, () => readPdfWithAgent(file));
      return;
    }
    setError('Try a CSV, PDF or picture.');
  }, [importCsv, readWithAgent]);

  /** Several screenshots become one import, so overlapping screens can't double count. */
  const addFiles = useCallback(async (files: File[], source: TransactionSource = 'agent') => {
    const images = files.filter(isImage);
    if (images.length > 1) await readWithAgent(`Reading ${images.length} pictures`, source, () => readImagesWithAgent(images));
    else if (files[0]) await addFile(files[0], source);
  }, [addFile, readWithAgent]);

  /**
   * Pass the access when the sign-in window already ran from a click.
   * Says how many new purchases came in, or null if it couldn't look.
   */
  const connectGmail = useCallback(async (granted?: GoogleAccess, another = false): Promise<number | null> => {
    setError(null);
    const started = Date.now();
    const finished: AgentStep[] = [];
    const show = (step: AgentStep) => setSteps([...finished, step]);
    const complete = (step: AgentStep) => {
      finished.push(step);
      playSound('print');
      setSteps([...finished]);
    };

    try {
      show({ id: 'google', label: 'Connecting to Gmail', status: 'active' });
      const { token, canReadMail } = granted ?? await requestGmailAccess({ email, another });
      const user = await fetchGoogleUser(token);
      if (!another) {
        onUser?.(user);
        if (latestBudget.current) {
          // Ties this household to the Google account, so another device can find it
          void api.session(token).catch(() => undefined);
        } else {
          const restored = await restoreBudget(token);
          if (restored) {
            latestBudget.current = restored;
            setSteps(null);
            onRestored?.(restored);
            return 0;
          }
        }
      }
      if (!canReadMail) {
        setSteps(null);
        setError(GMAIL_UNTICKED);
        return null;
      }
      complete({ id: 'google', label: 'Connected to Gmail', status: 'complete' });

      const inbox = user.email || 'inbox';
      const progress = inboxProgress(inbox);
      const since = progress?.checked ?? latestBudget.current?.inboxesChecked?.[inbox] ?? null;
      show({ id: 'search', label: 'Looking through your inbox', status: 'active' });
      const ids = [...new Set([...(progress?.missed ?? []), ...await findReceiptEmails(token, since)])];
      const taps = await sortRowsWithAgent(await readWalletTaps(token, since), merchantRules);
      if (ids.length === 0 && taps.length === 0) {
        rememberInbox(inbox, started, []);
        setSteps(null);
        setError(since ? "You're all caught up. Nothing new since I last looked." : "I looked, but found no receipts or bank alerts from the last 90 days. Apple Pay or a statement can fill this in instead.");
        return 0;
      }
      complete({ id: 'search', label: 'Looked through your inbox', status: 'complete', detail: taps.length > 0 ? `${ids.length} emails, ${taps.length} Apple Pay taps` : `${ids.length} emails about money` });

      show({ id: 'read', label: 'Reading your receipts', status: 'active', detail: `0 of ${ids.length}` });
      const { texts: emails, missed } = await readEmails(token, ids, (done) => {
        show({ id: 'read', label: 'Reading your receipts', status: 'active', detail: `${done} of ${ids.length}` });
      });
      show({ id: 'read', label: 'Picking out your purchases', status: 'active' });
      // Receipts come first so a tap for the same purchase keeps the receipt's details
      const read = emails.length > 0 ? await readEmailsWithAgent(emails) : { rows: [], deadlines: [] };
      const rows = [...read.rows, ...taps];
      if (rows.length === 0) {
        rememberInbox(inbox, started, missed);
        setSteps(null);
        setError(since ? "You're all caught up. Nothing new since I last looked." : "I read those emails, but none of them were real purchases.");
        return 0;
      }
      complete({ id: 'read', label: 'Read your receipts', status: 'complete', detail: `${rows.length} purchases found` });
      setFound(rows.filter((row) => row.amount > 0));

      rememberInbox(inbox, started, missed);
      return await fillSheet(rows, 'mail', finished, read.deadlines, (current) => ({ ...current, inboxesChecked: { ...current.inboxesChecked, [inbox]: started } }));
    } catch (problem) {
      setSteps(null);
      const friendly = problem instanceof GmailError || problem instanceof StatementError;
      setError(friendly ? problem.message : 'Something went wrong while reading your email. Try again in a moment.');
      return null;
    }
  }, [email, fillSheet, merchantRules, onRestored, onUser]);

  /** Everything connected sources reported since this device last asked. */
  const readSightings = useCallback(async (): Promise<number> => {
    let after = latestBudget.current?.sightingsRead ?? 0;
    const sightings: Sighting[] = [];
    const removed: string[] = [];
    for (let more = true; more;) {
      const page = await api.sightings(after);
      sightings.push(...page.sightings);
      removed.push(...page.removed);
      after = page.next;
      more = page.more;
    }
    if (sightings.length === 0 && removed.length === 0) return 0;
    const rows = await sortRowsWithAgent(rowsFromSightings(sightings), merchantRules);
    return fillSheet(rows, 'bank', [], [], (current) => ({ ...withdrawSightings(current, removed), sightingsRead: after }));
  }, [fillSheet, merchantRules]);

  /** Pulls anything new from banks and Wallet. Quiet, because it runs on its own. */
  const checkConnected = useCallback(async (): Promise<number> => {
    try {
      await api.session();
      await api.sync();
      return await readSightings();
    } catch {
      // Being offline or logged out shouldn't get in the way of the rest of the app
      return 0;
    }
  }, [readSightings]);

  /** New taps wait on the server, so while the app is open a quick look is all it takes. */
  const lookForTaps = useCallback(async (): Promise<void> => {
    try {
      await readSightings();
    } catch {
      // It looks again in a minute
    }
  }, [readSightings]);

  /** One login in the bank's own window, then every account and card flows in. */
  const connectBank = useCallback(async (relink?: string): Promise<boolean> => {
    setError(null);
    try {
      await api.session();
      const { linkToken, mode } = await api.linkToken(relink);
      const publicToken = mode === 'mock' ? 'mock' : await openPlaidLink(linkToken);
      if (!publicToken) return false;

      setSteps([{ id: 'bank', label: 'Connecting to your bank', status: 'active' }]);
      let notReady = false;
      if (relink) {
        const { results } = await api.sync(true);
        notReady = results.some((result) => result.notReady);
      } else {
        notReady = (await api.connectBank(publicToken)).notReady;
      }

      for (let poll = 0; notReady && poll < BANK_POLLS; poll++) {
        await wait(BANK_POLL_MS);
        setSteps([{ id: 'bank', label: 'Reading your history', status: 'active' }]);
        notReady = (await api.sync(true)).results.some((result) => result.notReady);
      }
      const added = await readSightings();
      setSteps(null);
      if (added === 0) playSound('complete');
      return true;
    } catch (problem) {
      setSteps(null);
      setError(problem instanceof ApiProblem ? problem.message : "I couldn't reach your bank. Try again.");
      return false;
    }
  }, [readSightings]);

  /** The same run with a made-up family's money, so anyone can see the whole flow. */
  const runDemo = useCallback(async () => {
    const rows = parseStatement(sampleStatement(new Date()));
    const spending = rows.filter((row) => row.amount > 0);
    const finished: AgentStep[] = [];
    const step = async (id: string, active: string, done: string, detail: string) => {
      setSteps([...finished, { id, label: active, status: 'active' }]);
      await wait(STEP_PAUSE_MS * 1.5);
      finished.push({ id, label: done, status: 'complete', detail });
      playSound('print');
      setSteps([...finished]);
    };

    await step('google', 'Opening the demo inbox', 'Opened the demo inbox', '');
    await step('search', 'Looking through the inbox', 'Looked through the inbox', `${rows.length} emails about money`);
    setFound(spending);
    await step('read', 'Reading the receipts', 'Read the receipts', `${spending.length} purchases found`);
    await fillSheet(rows, 'mail', finished, [], (same) => same, false);
  }, [fillSheet]);

  /** Budgets from before the agent told one-offs apart get the same read, once. */
  const rethink = useCallback(async (): Promise<Budget | null> => {
    const current = latestBudget.current;
    if (!current || current.rhythms || current.transactions.length === 0) return null;
    const verdicts = await judgeRhythms(sortTransfersToPeople(current));
    const latest = latestBudget.current;
    if (!verdicts || !latest) return null;
    const next = autoBudget(sortTransfersToPeople({ ...latest, rhythms: verdicts }));
    latestBudget.current = next;
    return next;
  }, []);

  return { steps, error, found, addFile, addFiles, connectGmail, connectBank, checkConnected, lookForTaps, rethink, runDemo, importCsv };
}
