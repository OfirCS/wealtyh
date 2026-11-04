'use client';

import { motion } from 'framer-motion';
import { GMAIL_READY } from '@/lib/gmail';
import { LogoMark } from '@/components/ui/Logo';

interface SignInProps {
  problem: string | null;
  onGoogle: () => void;
  onDemo: () => void;
  onBack: () => void;
}

const PROMISES = [
  'Read-only access to Gmail',
  'No bank login, ever',
  'It never moves real money',
];

export default function SignIn({ problem, onGoogle, onDemo, onBack }: SignInProps) {
  return (
    <div className="relative flex h-[100dvh] items-center justify-center overflow-hidden bg-[var(--pf-ink)] p-5">
      <div aria-hidden className="pf-grid-dark pointer-events-none absolute inset-0" />
      <motion.div
        className="relative w-full max-w-[440px] rounded-[28px] bg-[var(--pf-ivory)] p-7 text-[var(--pf-ink)] shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:p-9"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.6 }}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pf-ink)] text-[var(--pf-agent)]"><LogoMark size={24} /></span>
        <h1 className="mt-5 font-serif text-[38px] leading-[1.05] tracking-tight">Sign in. That&rsquo;s the only step.</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">Your agent connects to Gmail and builds your budget for you.</p>

        <button type="button" onClick={onGoogle} disabled={!GMAIL_READY} className="pf-btn pf-btn-primary mt-6 h-[54px] w-full text-[16px]">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
            <path d="M21.800 10.200H12v3.900h5.600c-.5 2.500-2.600 3.900-5.600 3.900a6 6 0 1 1 3.900-10.600l2.900-2.900A10 10 0 1 0 12 22c5.800 0 9.900-4 9.900-9.900 0-.6-.1-1.300-.1-1.900Z" />
          </svg>
          Continue with Google
        </button>
        {!GMAIL_READY && (
          <p className="mt-2 text-center text-[13px] leading-snug text-[var(--pf-warn)]">
            Google sign-in needs its client ID first. The demo works right now.
          </p>
        )}
        {problem && <p className="mt-2 text-center text-[14px] text-[var(--pf-warn)]" role="alert">{problem}</p>}

        <button type="button" onClick={onDemo} className="pf-btn pf-btn-secondary mt-3 h-[54px] w-full text-[16px]">Try the demo account</button>

        <ul className="mt-5 flex flex-col gap-1.5 border-t border-[var(--pf-border)] pt-4">
          {PROMISES.map((promise) => (
            <li key={promise} className="flex items-center gap-2.5 text-[14px] text-[var(--pf-text-secondary)]">
              <span aria-hidden className="text-[var(--pf-good)]">✓</span>{promise}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onBack} className="pf-link mt-3">Back</button>
      </motion.div>
    </div>
  );
}
