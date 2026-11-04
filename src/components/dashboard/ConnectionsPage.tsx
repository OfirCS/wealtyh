'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Budget, TransactionSource } from '@/lib/budget';
import { GMAIL_READY, lastGmailCheck } from '@/lib/gmail';
import type { Session } from '@/lib/session';
import type { AgentStep } from '@/components/ui/AgentSteps';
import AgentSteps from '@/components/ui/AgentSteps';
import ApplePanel from '@/components/budget/ApplePanel';
import { FilePanel } from '@/components/budget/FilePanel';

interface ConnectionsPageProps {
  session: Session;
  budget: Budget | null;
  steps: AgentStep[] | null;
  problem: string | null;
  onCheckGmail: () => void;
  onFile: (file: File) => void;
}

function count(budget: Budget | null, source: TransactionSource): number {
  return budget?.transactions.filter((transaction) => transaction.source === source).length ?? 0;
}

export default function ConnectionsPage({ session, budget, steps, problem, onCheckGmail, onFile }: ConnectionsPageProps) {
  const [panel, setPanel] = useState<'apple' | 'file' | null>(null);
  const checked = lastGmailCheck();
  const gmailOn = session.kind === 'google' || count(budget, 'mail') > 0;

  const cards = [
    {
      name: 'Gmail',
      body: 'Your agent reads receipts and bank alerts. Read-only.',
      status: session.kind === 'demo' ? `Demo inbox · ${count(budget, 'mail')} found` : gmailOn ? `Connected · ${count(budget, 'mail')} found` : 'Not connected',
      on: gmailOn,
      button: session.kind === 'demo' ? null : { label: 'Check for new', run: onCheckGmail, disabled: !GMAIL_READY || !!steps },
    },
    {
      name: 'Apple Pay',
      body: 'Every tap logs itself through an iPhone Shortcut.',
      status: count(budget, 'wallet') > 0 ? `Connected · ${count(budget, 'wallet')} tapped` : 'Set up once on your iPhone',
      on: count(budget, 'wallet') > 0,
      button: { label: 'Set up', run: () => setPanel('apple'), disabled: false },
    },
    {
      name: 'Bank statement',
      body: 'For banks that don’t send email alerts.',
      status: count(budget, 'statement') + count(budget, 'agent') > 0 ? `${count(budget, 'statement') + count(budget, 'agent')} added` : 'CSV or PDF',
      on: count(budget, 'statement') + count(budget, 'agent') > 0,
      button: { label: 'Add a file', run: () => setPanel('file'), disabled: false },
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="font-serif text-[clamp(26px,4.4vh,38px)] leading-none tracking-tight">Connections</h1>
        <p className="mt-1.5 text-[16px] text-[var(--pf-text-secondary)]">
          Where your agent looks.{checked ? ` Last checked ${new Date(checked).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}.` : ''}
        </p>
      </div>

      <div className="grid shrink-0 gap-3 md:grid-cols-3">
        {cards.map((card, index) => (
          <motion.section key={card.name} className="pf-card flex flex-col gap-3 p-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.5, delay: index * 0.06 }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold">{card.name}</h2>
              <span className={`h-2.5 w-2.5 rounded-full ${card.on ? 'bg-[var(--pf-good)]' : 'bg-[var(--pf-bg-dark)]'}`} />
            </div>
            <p className="text-[15px] leading-snug text-[var(--pf-text-secondary)]">{card.body}</p>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-[var(--pf-text-tertiary)]">{card.status}</span>
              {card.button && <button type="button" disabled={card.button.disabled} onClick={card.button.run} className="pf-btn pf-btn-secondary h-9 shrink-0 px-4 text-[13px]">{card.button.label}</button>}
            </div>
          </motion.section>
        ))}
      </div>

      {(steps || problem) && (
        <div className="pf-card shrink-0 p-5">
          {steps ? <AgentSteps steps={steps} /> : <p className="text-[15px]" role="status">{problem}</p>}
        </div>
      )}

      <AnimatePresence>
        {panel === 'apple' && <ApplePanel onClose={() => setPanel(null)} />}
        {panel === 'file' && <FilePanel onClose={() => setPanel(null)} onFile={onFile} />}
      </AnimatePresence>
    </div>
  );
}
