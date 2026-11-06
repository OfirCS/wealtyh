'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Landmark, Mail, Plus, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/client/api';
import type { Connections } from '@/client/api';
import type { Budget, TransactionSource } from '@/lib/budget';
import { GMAIL_READY, prepareGoogle } from '@/lib/gmail';
import type { Session } from '@/lib/session';
import type { AgentStep } from '@/components/ui/AgentSteps';
import ApplePanel from '@/components/budget/ApplePanel';
import { FilePanel } from '@/components/budget/FilePanel';

interface ConnectionsPageProps {
  session: Session;
  budget: Budget | null;
  steps: AgentStep[] | null;
  problem: string | null;
  onCheckGmail: () => void;
  /** Connects a second inbox, such as a partner's. */
  onAddInbox: () => void;
  /** One login at the bank. Pass a connection to fix a login that broke. */
  onConnectBank: (relink?: string) => Promise<boolean>;
  onCheckConnected: () => Promise<number>;
  /** Opens straight on the Wallet steps when the agent sent the user here. */
  openWallet?: boolean;
  onFiles: (files: File[], source?: TransactionSource) => void;
}

interface Row {
  id: string;
  name: string;
  icon: LucideIcon;
  status: string;
  on: boolean;
  /** Needs the person, so it gets the agent's colour. */
  urgent?: boolean;
  label?: string;
  run?: () => void;
  disabled?: boolean;
  /** Takes it away again, after asking. */
  remove?: () => void;
}

let lastKnown: Connections | null = null;

async function loadConnections(): Promise<Connections | null> {
  try {
    await api.session();
    lastKnown = await api.connections();
  } catch {
    // Keep showing what was last known
  }
  return lastKnown;
}

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.round(hours / 24)} d ago`;
}

/** One row per connection. The first thing to add gets the agent's colour, so there's always one obvious next step. */
function RowItem({ row, primary }: { row: Row; primary: boolean }) {
  const [removing, setRemoving] = useState(false);
  return (
    <li className="flex min-h-[56px] items-center gap-3 py-1.5">
      <row.icon size={20} strokeWidth={1.75} className="shrink-0 text-[var(--pf-text-secondary)]" aria-hidden />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[15px]">{row.name}</span>
        {row.status && <span className={`block truncate text-[13px] ${row.urgent ? 'text-[var(--pf-warn)]' : 'text-[var(--pf-text-tertiary)]'}`}>{row.status}</span>}
      </span>
      {row.label && (primary
        ? <button type="button" disabled={row.disabled} onClick={row.run} className="pf-btn pf-btn-agent h-9 shrink-0 rounded-[10px] px-4 text-[15px]">{row.label}</button>
        : <button type="button" disabled={row.disabled} onClick={row.run} className="shrink-0 cursor-pointer text-[15px] font-bold disabled:cursor-default disabled:opacity-40">{row.label}</button>)}
      {row.remove && (removing
        ? <button type="button" onClick={row.remove} className="shrink-0 cursor-pointer text-[15px] font-bold text-[var(--pf-warn)]">Sure?</button>
        : <button type="button" onClick={() => setRemoving(true)} className="shrink-0 cursor-pointer text-[15px] text-[var(--pf-text-tertiary)] hover:text-[var(--pf-warn)]">Disconnect</button>)}
    </li>
  );
}

function count(budget: Budget | null, source: TransactionSource): number {
  return budget?.transactions.filter((transaction) => transaction.source === source && transaction.amount > 0).length ?? 0;
}

function seenBy(budget: Budget | null, source: 'bank' | 'receipt' | 'wallet'): number {
  return budget?.transactions.filter((transaction) => transaction.sightings?.some((sighting) => sighting.source === source)).length ?? 0;
}

export default function ConnectionsPage({ session, budget, steps, problem, onCheckGmail, onAddInbox, onConnectBank, onCheckConnected, openWallet, onFiles }: ConnectionsPageProps) {
  const [panel, setPanel] = useState<'apple' | 'file' | null>(openWallet ? 'apple' : null);
  const [connected, setConnected] = useState<Connections | null>(lastKnown);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    setConnected(await loadConnections());
  }, []);

  useEffect(() => {
    prepareGoogle();
    let open = true;
    void loadConnections().then((result) => {
      if (open) setConnected(result);
    });
    return () => {
      open = false;
    };
  }, []);

  const connectBank = async (relink?: string) => {
    // Every login counts against the provider's plan, so a second click must do nothing
    if (connecting) return;
    setConnecting(true);
    if (await onConnectBank(relink)) await refresh();
    setConnecting(false);
  };

  const mail = Math.max(count(budget, 'mail'), seenBy(budget, 'receipt'));
  const taps = Math.max(count(budget, 'wallet'), seenBy(budget, 'wallet'));
  const gmailOn = session.kind === 'google' || mail > 0;
  const files = count(budget, 'statement') + count(budget, 'agent');
  const canBank = session.kind !== 'demo' && Boolean(connected?.bank);

  const bankRows: Row[] = (connected?.connections ?? []).map((connection) => {
    const broken = connection.status !== 'ok';
    return {
      id: connection.id,
      name: connection.institution,
      icon: Landmark,
      status: broken ? 'Needs you to sign in again' : `${seenBy(budget, 'bank')} found${connection.syncedAt ? ` · ${ago(connection.syncedAt)}` : ''}`,
      on: true,
      urgent: broken,
      ...(broken
        ? { label: 'Sign in', run: () => void connectBank(connection.id), disabled: !!steps || connecting }
        : { label: 'Check', run: () => void onCheckConnected().then(refresh), disabled: !!steps }),
      remove: () => void api.disconnect(connection.id).then(refresh),
    };
  });

  const walletLinked = Boolean(connected?.wallet.connected);
  const lastTap = connected?.wallet.lastTap;
  const tapCount = `${taps} ${taps === 1 ? 'tap' : 'taps'}`;
  const walletStatus = lastTap && taps > 0 ? `${tapCount} · ${ago(lastTap)}`
    : lastTap ? 'iPhone connected. Pay once to test it'
      : walletLinked ? 'Waiting for your first tap'
        : taps > 0 ? tapCount : '';
  const wallet: Row = { id: 'wallet', name: 'Apple Wallet', icon: Wallet, status: walletStatus, on: taps > 0 || walletLinked, label: taps > 0 || walletLinked ? 'Steps' : 'Connect', run: () => setPanel('apple') };
  const gmail: Row = {
    id: 'gmail',
    name: 'Gmail',
    icon: Mail,
    status: gmailOn ? `${mail} purchases` : '',
    on: gmailOn,
    ...(session.kind === 'demo' ? {} : { label: gmailOn ? 'Check' : 'Connect', run: onCheckGmail, disabled: !GMAIL_READY || !!steps }),
  };
  const rows: Row[] = [
    ...bankRows,
    gmail,
    wallet,
    ...(canBank ? [{ id: 'bank', name: bankRows.length > 0 ? 'Another bank' : 'Bank and cards', icon: bankRows.length > 0 ? Plus : Landmark, status: '', on: false, label: 'Connect', run: () => void connectBank(), disabled: !!steps || connecting }] : []),
    ...(session.kind === 'google' && GMAIL_READY ? [{ id: 'inbox', name: 'Another inbox', icon: Plus, status: '', on: false, label: 'Add', run: onAddInbox, disabled: !!steps }] : []),
    { id: 'file', name: 'Statement', icon: FileText, status: files > 0 ? `${files} added` : '', on: false, label: 'Add', run: () => setPanel('file') },
  ];
  const live = rows.filter((row) => row.on);
  const more = rows.filter((row) => !row.on);

  return (
    <div className="pf-card mx-auto w-full max-w-[640px] p-4 lg:px-6">
      <h1 className="pf-title">Accounts</h1>
      <p className="mt-0.5 text-[15px] text-[var(--pf-text-secondary)]">Read-only. Nothing here can move your money.</p>

      <motion.ul className="mt-3 divide-y divide-[var(--pf-border)]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
        {[...live, ...more].map((row, index) => <RowItem key={row.id} row={row} primary={!!row.urgent || index === live.length} />)}
      </motion.ul>

      {problem && !steps && <p className="text-[15px] text-[var(--pf-warn)]" role="status">{problem}</p>}

      <AnimatePresence>
        {panel === 'apple' && <ApplePanel canConnect={session.kind === 'google'} connected={walletLinked} status={walletLinked || taps > 0 ? walletStatus : 'Every Apple Pay tap lands here.'} onLinked={() => void refresh()} onClose={() => setPanel(null)} />}
        {panel === 'file' && <FilePanel onClose={() => setPanel(null)} onFiles={onFiles} />}
      </AnimatePresence>
    </div>
  );
}
