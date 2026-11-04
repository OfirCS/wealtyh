'use client';

import { motion } from 'framer-motion';
import { LogoMark } from '@/components/ui/Logo';
import LiveAgent from './LiveAgent';

interface LandingProps {
  onStart: () => void;
  onDemo: () => void;
}

const STEPS = [
  { title: 'Sign in with Google', body: 'One click. No bank login.' },
  { title: 'Your agent reads your receipts', body: 'You don’t type a thing.' },
  { title: 'Your budget is ready', body: 'Just say yes to what it suggests.' },
];

export default function Landing({ onStart, onDemo }: LandingProps) {
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[var(--pf-ink)] text-[var(--pf-ivory)]">
      <div aria-hidden className="pf-grid-dark pointer-events-none absolute inset-0" />

      <header className="relative mx-auto flex h-[72px] w-full max-w-[1240px] shrink-0 items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="font-serif text-[24px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" className="hidden cursor-pointer text-[15px] font-medium text-[var(--pf-ivory-dim)] hover:text-[var(--pf-ivory)] sm:block" onClick={onStart}>Sign in</button>
          <button type="button" className="pf-btn pf-btn-agent h-10 px-5 text-[14px]" onClick={onStart}>Get started</button>
        </div>
      </header>

      <main className="relative mx-auto grid min-h-0 w-full max-w-[1240px] flex-1 items-center gap-x-16 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.8 }}>
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--pf-ink-soft)] px-3.5 py-1.5 text-[14px] text-[var(--pf-ivory-dim)]">
            <span className="pf-pulse h-2 w-2 rounded-full bg-[var(--pf-agent)]" />
            For Canadian families
          </p>
          <h1 className="pf-hero-title mt-5 font-serif">The family budget that builds itself.</h1>
          <p className="mt-5 max-w-[520px] text-[18px] leading-relaxed text-[var(--pf-ivory-dim)] sm:text-[20px]">
            Sign in once. Your agent reads your receipts, sorts your spending, and tells you what to do next.
          </p>
          <div className="mt-[clamp(18px,4vh,32px)] flex flex-wrap items-center gap-3">
            <button type="button" className="pf-btn pf-btn-agent h-14 px-8 text-[17px]" onClick={onStart}>Get started free</button>
            <button type="button" className="pf-btn pf-btn-outline-dark h-14 px-7 text-[17px]" onClick={onDemo}>Try the demo</button>
          </div>
        </motion.div>

        <motion.div className="hidden lg:block" initial={{ opacity: 0, y: 24, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', bounce: 0.1, duration: 1, delay: 0.15 }}>
          <LiveAgent />
        </motion.div>
      </main>

      <footer className="relative mx-auto hidden w-full max-w-[1240px] shrink-0 grid-cols-3 gap-8 px-8 pb-7 pt-3 sm:grid">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex items-start gap-3 border-t border-[var(--pf-ink-line)] pt-4">
            <span className="font-serif text-[22px] leading-none text-[var(--pf-agent)]">{index + 1}</span>
            <div>
              <p className="text-[15px] font-semibold leading-tight">{step.title}</p>
              <p className="mt-0.5 text-[14px] text-[var(--pf-ivory-dim)]">{step.body}</p>
            </div>
          </div>
        ))}
      </footer>
    </div>
  );
}
