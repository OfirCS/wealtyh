'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Landmark, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/client/api';
import type { Connections } from '@/client/api';
import { tidyName } from '@/lib/agent-insights';
import type { Budget } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { budgetStory } from '@/lib/month-picture';
import { DEMO_SESSION } from '@/lib/session';
import type { Session } from '@/lib/session';
import type { GoogleAccess } from '@/lib/gmail';
import { playSound } from '@/lib/sounds';
import { localDay } from '@/lib/streak';
import { useBudgetImport } from '@/lib/use-budget-import';
import ApplePanel from '@/components/budget/ApplePanel';
import AgentLight from '@/components/ui/AgentLight';
import type { AgentStep } from '@/components/ui/AgentSteps';

interface AgentRunProps {
  mode: 'google' | 'demo';
  /** Granted by the sign-in window, for a Google run. */
  access?: GoogleAccess | null;
  onDone: (budget: Budget | null, session: Session) => void;
  onFailed: (problem: string) => void;
}

const VISIBLE_ROWS = 7;
const ROW_HEIGHT = 21;
const REVEAL_MS = 170;
const FINISH_PAUSE_MS = 1400;

function money(value: number): string {
  return value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SetupRow({ icon: Icon, name, detail, done, action, disabled, onChoose }: { icon: LucideIcon; name: string; detail: string; done: boolean; action: string; disabled: boolean; onChoose: () => void }) {
  return (
    <li className="flex items-center gap-3 border-b border-[var(--pf-border)] py-2.5">
      <Icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[16px]">{name}</span>
        <span className="block truncate text-[13px] text-[var(--pf-text-tertiary)]">{detail}</span>
      </span>
      {done
        ? <span className="flex shrink-0 items-center gap-1 text-[14px] font-medium text-[var(--pf-good)]"><Check size={15} strokeWidth={2.5} aria-hidden /> Connected</span>
        : <button type="button" disabled={disabled} onClick={onChoose} className="pf-action">{action}</button>}
    </li>
  );
}

/** The moment the product is about: a receipt of your whole month prints while you watch. */
export default function AgentRun({ mode, access, onDone, onFailed }: AgentRunProps) {
  const [revealed, setRevealed] = useState(0);
  const [finished, setFinished] = useState<Budget | null>(null);
  const [returning, setReturning] = useState(false);
  const [user, setUser] = useState<Session>(DEMO_SESSION);
  const [printed, setPrinted] = useState<AgentStep[]>([]);
  const [connections, setConnections] = useState<Connections | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [today] = useState(() => localDay());
  const started = useRef(false);

  const onImported = useCallback((budget: Budget) => setFinished(budget), []);
  const onRestored = useCallback((budget: Budget) => {
    setReturning(true);
    setFinished(budget);
  }, []);
  const onUser = useCallback((next: { name: string; email: string }) => {
    setUser({ ...next, kind: 'google' });
  }, []);

  const { steps, error, found, connectGmail, connectBank, runDemo } = useBudgetImport({ budget: finished, fallbackIncome: 0, onImported, onUser, onRestored });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (mode === 'demo' ? runDemo() : connectGmail(access ?? undefined));
  }, [mode, access, runDemo, connectGmail]);

  // The agent clears its steps when it's done, but the receipt keeps what it printed
  if (steps && steps !== printed) setPrinted(steps);

  useEffect(() => {
    if (found.length === 0) return;
    const timer = window.setInterval(() => {
      setRevealed((value) => {
        if (value >= found.length) return value;
        playSound('print');
        return value + 1;
      });
    }, REVEAL_MS);
    return () => window.clearInterval(timer);
  }, [found.length]);

  // A first sign-in stops here to finish the setup. The demo, or a known family, goes straight in
  const setup = !!finished && mode === 'google' && !returning;

  useEffect(() => {
    if (!finished || setup) return;
    const timer = window.setTimeout(() => onDone(finished, user), FINISH_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [finished, setup, onDone, user]);

  const loadConnections = useCallback(() => {
    void api.session().then(api.connections).then(setConnections).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (setup) loadConnections();
  }, [setup, loadConnections]);

  const addBank = async () => {
    // Every login counts against the provider's plan, so a second click must do nothing
    if (connecting) return;
    setConnecting(true);
    await connectBank();
    loadConnections();
    setConnecting(false);
  };

  const spent = found.slice(0, revealed).reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const rows = found.slice(Math.max(0, revealed - VISIBLE_ROWS), revealed);
  const printing = printed.at(-1)?.label;
  const story = finished ? budgetStory(finished, today) : null;
  const bankDone = (connections?.connections.length ?? 0) > 0;
  const walletDone = !!connections?.wallet.connected;
  const numbers = story ? [
    { label: 'Bills', value: story.bills },
    { label: 'Everyday', value: story.everyday },
    { label: 'One-time', value: story.oneTime },
  ] : [];

  return (
    <div className="pf-paper flex h-[100dvh] items-center overflow-hidden">
      <div className="mx-auto grid w-full max-w-[1040px] items-center gap-x-16 gap-y-6 px-5 sm:px-8 lg:grid-cols-[1fr_400px]">
        <div>
          <p className="flex items-center gap-2 text-[15px] text-[var(--pf-text-secondary)]" role="status">
            <AgentLight working={!finished && !error} size={9} />
            {steps ? printing : finished ? 'All done' : printing ?? 'Starting'}
          </p>
          <h1 className="pf-title-xl mt-3 font-serif">{finished ? 'Your budget is ready.' : 'Your agent is working.'}</h1>

          {setup && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.5 }}>
              <dl className="mt-5 grid grid-cols-3 gap-x-4 border-t border-[var(--pf-text-primary)] pt-2.5">
                {numbers.map((number) => (
                  <div key={number.label} className="min-w-0">
                    <dt className="pf-label">{number.label}</dt>
                    <dd className="mt-0.5 truncate font-serif text-[clamp(24px,3.4vw,32px)] leading-tight">{formatMoney(number.value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[14px] text-[var(--pf-text-secondary)]">Built from what really repeats. One-time spending stays out of it.</p>

              <h2 className="pf-label mt-5">Finish your setup, once</h2>
              <ul className="mt-1 border-t border-[var(--pf-border)]">
                {connections?.bank && <SetupRow icon={Landmark} name="Bank and cards" detail="Every card purchase, read-only" done={bankDone} action={connecting ? 'Connecting…' : 'Connect'} disabled={connecting || !!steps} onChoose={() => void addBank()} />}
                <SetupRow icon={Wallet} name="Apple Wallet" detail="Every Apple Pay tap" done={walletDone} action="Connect" disabled={false} onChoose={() => setWalletOpen(true)} />
              </ul>

              <button type="button" disabled={!!steps} onClick={() => onDone(finished, user)} className="pf-btn pf-btn-agent mt-4 h-12 w-full">Open my budget</button>
              <p className="mt-2 text-center text-[13.5px] text-[var(--pf-text-secondary)]">From here, I keep it up to date.</p>
            </motion.div>
          )}

          {error && (
            <div className="mt-5">
              <p className="text-[17px]" role="alert">{error}</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {mode === 'google' && <button type="button" className="pf-btn pf-btn-primary" onClick={() => void connectGmail()}>Try again</button>}
                {user.kind === 'google' && <button type="button" className="pf-btn pf-btn-secondary" onClick={() => onDone(null, user)}>Go to my budget</button>}
                {user.kind !== 'google' && <button type="button" className="pf-btn pf-btn-secondary" onClick={() => onFailed(error)}>Go back</button>}
              </div>
            </div>
          )}
        </div>

        <div className={`pf-tape mx-auto max-w-[400px] ${setup ? 'hidden lg:block' : ''}`}>
          <div aria-hidden className="pf-tape-slot" />
          <div className="pf-tape-shadow">
            <div className="pf-receipt px-5 pb-6 pt-4 text-[13px] uppercase leading-relaxed">
              <p className="text-center tracking-[0.2em]">Pathfinder</p>
              <p aria-hidden className="mt-2 border-t border-dashed border-[var(--pf-text-tertiary)]" />

              <ol className="mt-2" aria-live="polite">
                {printed.map((step) => (
                  <li key={step.id} className="flex items-baseline gap-1.5">
                    <span className="min-w-0 truncate">{step.label}</span>
                    <span aria-hidden className="pf-tape-leader" />
                    {step.status === 'complete'
                      ? <span className="max-w-[50%] shrink-0 truncate">{step.detail || 'OK'}</span>
                      : <span aria-hidden className="pf-tape-cursor" />}
                  </li>
                ))}
              </ol>

              {rows.length > 0 && (
                <>
                  <p aria-hidden className="mt-2 border-t border-dashed border-[var(--pf-text-tertiary)]" />
                  <ul className="mt-2 overflow-hidden" style={{ height: VISIBLE_ROWS * ROW_HEIGHT }}>
                    <AnimatePresence initial={false}>
                      {rows.map((row) => (
                        <motion.li
                          key={`${row.date}-${row.description}-${row.amount}`}
                          layout="position"
                          className="flex items-baseline justify-between gap-3"
                          style={{ height: ROW_HEIGHT }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                        >
                          <span className="min-w-0 truncate">{tidyName(row.description)}</span>
                          <span className="shrink-0 tabular-nums">{money(row.amount)}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <p className="mt-2 flex items-baseline justify-between gap-3 border-t border-dashed border-[var(--pf-text-tertiary)] pt-2 font-bold">
                    <span>{revealed} purchases</span>
                    <span className="tabular-nums">${money(spent)}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {walletOpen && <ApplePanel canConnect connected={walletDone} status={walletDone ? 'Waiting for your first tap' : 'Every Apple Pay tap lands here.'} onLinked={loadConnections} onClose={() => setWalletOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
