'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cable, ChartColumn, LogOut, ReceiptText, ShieldCheck, Table2, Volume2, VolumeX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import InstallHint from '@/client/InstallHint';
import type { Session } from '@/lib/session';
import { isSoundEnabled, subscribeToSound, toggleSound } from '@/lib/sounds';
import AgentLight from '@/components/ui/AgentLight';
import AgentSteps from '@/components/ui/AgentSteps';
import type { AgentStep } from '@/components/ui/AgentSteps';
import ContextMenu, { useContextMenu } from '@/components/ui/ContextMenu';
import { LogoMark } from '@/components/ui/Logo';

export type Section = 'budget' | 'plans' | 'connections';
export type View = 'month' | 'year' | 'transactions';

interface AppShellProps {
  section: Section;
  view: View;
  session: Session;
  /** What the agent is doing right now. */
  steps: AgentStep[] | null;
  onNavigate: (section: Section) => void;
  onView: (view: View) => void;
  onAsk: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

const VIEWS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'month', label: 'Month', icon: Table2 },
  { id: 'year', label: 'Year', icon: ChartColumn },
  { id: 'transactions', label: 'Purchases', icon: ReceiptText },
];

export default function AppShell({ section, view, session, steps, onNavigate, onView, onAsk, onSignOut, children }: AppShellProps) {
  const working = steps?.at(-1)?.label ?? null;
  const initial = session.name.charAt(0).toUpperCase() || 'P';
  const { target, open, close } = useContextMenu<object>();
  const soundOn = useSyncExternalStore(subscribeToSound, isSoundEnabled, () => true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onAsk();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAsk]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--pf-bg-primary)] font-medium">
      <header className="hidden shrink-0 lg:block">
        <div className="mx-auto grid h-[60px] w-full max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size={22} />
            <span className="font-serif text-[22px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
            {session.kind === 'demo' && <span className="ml-1 text-[13px] text-[var(--pf-text-tertiary)]">Demo</span>}
          </div>

          <div role="tablist" aria-label="Views" className="flex h-full items-stretch gap-8">
            {VIEWS.map((item) => {
              const active = section === 'budget' && view === item.id;
              return (
                <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => onView(item.id)} className={`relative flex cursor-pointer items-center text-[15px] transition-colors ${active ? '' : 'text-[var(--pf-text-tertiary)] hover:text-[var(--pf-text-primary)]'}`}>
                  {item.label}
                  {active && <motion.span layoutId="pf-nav-mark" className="absolute inset-x-0 bottom-[14px] h-[2px] bg-[var(--pf-text-primary)]" transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-4">
            <button type="button" aria-label="Ask" title="⌘K" onClick={onAsk} className="flex h-9 cursor-pointer items-center gap-2 text-[15px]">
              <AgentLight working={!!working} />
              Ask
            </button>
            <button type="button" aria-label="Account" onClick={(event) => open(event, {})} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--pf-border)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--pf-text-tertiary)]">{initial}</button>
          </div>
        </div>
      </header>

      <main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
        <div className="mx-auto h-full w-full max-w-[1232px]">{children}</div>
      </main>

      <InstallHint />

      <nav aria-label="Main" className="flex h-[calc(62px+var(--pf-badge-room,0px))] shrink-0 items-stretch border-t border-[var(--pf-border)] bg-[var(--pf-bg-primary)] pb-[var(--pf-badge-room,0px)] lg:hidden">
        <div role="tablist" aria-label="Views" className="contents">
          {VIEWS.map((item, index) => <MobileTab key={item.id} item={item} active={section === 'budget' && view === item.id} order={index < 2 ? 'order-1' : 'order-3'} onSelect={() => onView(item.id)} />)}
        </div>
        <div className="order-2 flex flex-1 items-center justify-center">
          <button type="button" aria-label="Ask" onClick={onAsk} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--pf-ink)]"><AgentLight working={!!working} size={11} onDark /></button>
        </div>
        <button type="button" aria-label="Account" onClick={(event) => open(event, {})} className="order-4 flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[13px] text-[var(--pf-text-tertiary)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shadow-[inset_0_0_0_1.5px_currentColor]">{initial}</span>
          You
        </button>
      </nav>

      <AnimatePresence>
        {steps && (
          <motion.div
            className="fixed inset-x-4 bottom-[calc(74px+var(--pf-badge-room,0px))] z-30 mx-auto max-w-[400px] lg:inset-x-auto lg:bottom-[calc(24px+var(--pf-badge-room,0px))] lg:right-6 lg:w-[400px]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <AgentSteps steps={steps} />
          </motion.div>
        )}
      </AnimatePresence>

      <ContextMenu
        at={target}
        onClose={close}
        items={[
          { kind: 'heading', label: session.email || session.name || 'Your account' },
          { kind: 'action', label: 'Accounts', icon: Cable, onSelect: () => onNavigate('connections') },
          { kind: 'action', label: soundOn ? 'Turn sounds off' : 'Turn sounds on', icon: soundOn ? VolumeX : Volume2, onSelect: toggleSound },
          { kind: 'action', label: 'Privacy', icon: ShieldCheck, onSelect: () => window.open('/privacy', '_blank', 'noreferrer') },
          { kind: 'divider' },
          { kind: 'action', label: 'Sign out', icon: LogOut, onSelect: onSignOut },
        ]}
      />
    </div>
  );
}

function MobileTab({ item, active, order, onSelect }: { item: (typeof VIEWS)[number]; active: boolean; order: string; onSelect: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[13px] ${order} ${active ? 'text-[var(--pf-text-primary)]' : 'text-[var(--pf-text-tertiary)]'}`}
    >
      <Icon size={20} strokeWidth={1.75} />
      {item.label}
    </button>
  );
}
