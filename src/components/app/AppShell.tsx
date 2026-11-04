'use client';

import type { Session } from '@/lib/session';
import { LogoMark } from '@/components/ui/Logo';
import SoundToggle from '@/components/ui/SoundToggle';

export type Section = 'home' | 'budget' | 'plans' | 'connections';

interface AppShellProps {
  section: Section;
  session: Session;
  onNavigate: (section: Section) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

const ICONS: Record<Section, React.ReactNode> = {
  home: <path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />,
  budget: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 10v10" /></>,
  plans: <path d="M5 19c3-1 3-6 7-7s4-5 7-7M15 5h4v4" />,
  connections: <path d="M9 15 15 9M10 6.500 11.500 5a4 4 0 0 1 5.700 5.700L15.500 12.500M8.500 11.500 6.800 13.200a4 4 0 0 0 5.700 5.700l1.500-1.500" />,
};

const ITEMS: { id: Section; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'budget', label: 'Budget' },
  { id: 'plans', label: 'Plans' },
  { id: 'connections', label: 'Connections' },
];

function Icon({ section }: { section: Section }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[section]}
    </svg>
  );
}

export default function AppShell({ section, session, onNavigate, onSignOut, children }: AppShellProps) {
  const initial = session.name.charAt(0).toUpperCase() || 'P';

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--pf-bg-primary)]">
      <aside className="hidden w-[216px] shrink-0 flex-col bg-[var(--pf-ink)] p-4 text-[var(--pf-ivory)] lg:flex">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <LogoMark size={24} />
          <span className="font-serif text-[22px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
        </div>

        <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`flex h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium transition-colors ${section === item.id ? 'bg-[var(--pf-agent)] text-[var(--pf-ink)]' : 'text-[var(--pf-ivory-dim)] hover:bg-[var(--pf-ink-soft)] hover:text-[var(--pf-ivory)]'}`}
            >
              <Icon section={item.id} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          {session.kind === 'demo' && (
            <p className="mb-3 rounded-[12px] bg-[var(--pf-ink-soft)] p-3 text-[13px] leading-snug text-[var(--pf-ivory-dim)]">You&rsquo;re in the demo, with a made-up family.</p>
          )}
          <div className="flex items-center gap-2.5 rounded-[12px] bg-[var(--pf-ink-soft)] p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--pf-ivory)] text-[14px] font-semibold text-[var(--pf-ink)]">{initial}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium leading-tight">{session.name}</span>
              <button type="button" onClick={onSignOut} className="cursor-pointer text-[12px] text-[var(--pf-ivory-dim)] hover:text-[var(--pf-ivory)]">Sign out</button>
            </span>
            <span className="text-[var(--pf-ivory)] [&_button:hover]:bg-[var(--pf-ink)] [&_button]:text-[var(--pf-ivory)]"><SoundToggle /></span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 p-4 sm:p-5">{children}</main>

        <nav aria-label="Main" className="flex h-[62px] shrink-0 items-stretch border-t border-[var(--pf-border)] bg-[var(--pf-bg-surface)] lg:hidden">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${section === item.id ? 'text-[var(--pf-text-primary)]' : 'text-[var(--pf-text-tertiary)]'}`}
            >
              <Icon section={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
