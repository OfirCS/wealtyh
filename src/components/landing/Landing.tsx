'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { GMAIL_READY, GmailError, prepareGoogle, requestGmailAccess } from '@/lib/gmail';
import type { GoogleAccess } from '@/lib/gmail';
import { LogoMark } from '@/components/ui/Logo';
import BankFlip from './BankFlip';
import Extras from './Extras';
import PlanCards from './PlanCards';
import Questions from './Questions';
import ReceiptDesk from './ReceiptDesk';
import Reveal from './Reveal';
import SetupSteps from './SetupSteps';
import Trust from './Trust';

interface LandingProps {
  problem: string | null;
  onGoogle: (access: GoogleAccess) => void;
  onDemo: () => void;
}

const WORKS_WITH = ['Gmail', 'Apple Wallet', 'RBC', 'TD', 'Scotiabank', 'BMO', 'CIBC', 'Tangerine', 'Amex'];
const SCROLLED_PAST = 12;
const RECEIPT = [['BILLS', '3,370.00'], ['EVERYDAY', '1,224.00'], ['ONE-TIME', 'LEFT OUT'], ['ASKED YOU', '1 THING']];

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Landing({ problem, onGoogle, onDemo }: LandingProps) {
  const [waiting, setWaiting] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const message = trouble ?? problem;

  useEffect(() => {
    prepareGoogle();
  }, []);

  const signIn = async () => {
    setTrouble(null);
    setWaiting(true);
    try {
      onGoogle(await requestGmailAccess());
    } catch (error) {
      setTrouble(error instanceof GmailError ? error.message : 'Something went wrong. Try again.');
      setWaiting(false);
    }
  };

  const start = GMAIL_READY ? signIn : onDemo;

  return (
    <div data-scroller onScroll={(event) => setScrolled(event.currentTarget.scrollTop > SCROLLED_PAST)} className="pf-paper h-[100dvh] overflow-x-hidden overflow-y-auto scroll-smooth">
      <header className={`sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 ${scrolled ? 'bg-[var(--pf-bg-primary)]/95 shadow-[0_1px_0_var(--pf-border)] backdrop-blur-md' : ''}`}>
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-2.5 px-5 sm:px-8">
          <LogoMark size={22} />
          <span className="font-serif text-[22px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
          <nav aria-label="On this page" className="ml-auto flex items-center gap-6">
            <a href="#why" className="pf-link hidden text-[15px] md:inline">Why not my bank?</a>
            <a href="#how" className="pf-link hidden text-[15px] md:inline">How it works</a>
            <a href="#plans" className="pf-link hidden text-[15px] md:inline">Plans</a>
            <button type="button" onClick={() => void start()} className="pf-btn pf-btn-primary h-10 rounded-[11px] px-4 text-[14.5px]">Start free</button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-[1320px] gap-x-14 gap-y-8 px-5 pb-10 pt-4 sm:px-8 lg:min-h-[calc(100dvh-148px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:pb-12">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.8 }}>
            <h1 className="pf-hero-title font-serif">The budget your bank could <span className="pf-marker">never build.</span></h1>
            <p className="mt-5 max-w-[520px] text-[18px] leading-snug text-[var(--pf-text-secondary)] sm:text-[20px]">
              It reads your receipts, finds your bills and builds your family&rsquo;s budget in a couple of minutes. Then it keeps it up to date.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {GMAIL_READY && (
                <button type="button" onClick={() => void signIn()} disabled={waiting} className="pf-btn pf-btn-primary h-[54px] px-6 text-[16px]">
                  <GoogleMark />
                  {waiting ? 'Waiting for Google…' : 'Continue with Google'}
                </button>
              )}
              <button type="button" onClick={onDemo} className={`pf-btn h-[54px] px-6 text-[16px] ${GMAIL_READY ? 'pf-btn-secondary' : 'pf-btn-primary'}`}>Try the demo</button>
            </div>
            <p className="mt-3 text-[14.5px] text-[var(--pf-text-secondary)]">Free for good. Read-only. It can&rsquo;t move your money.</p>
          </motion.div>

          <motion.div className="h-[520px] lg:h-[min(calc(100dvh-180px),640px)]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <ReceiptDesk />
          </motion.div>
        </section>

        <section aria-label="Works with" className="mx-auto w-full max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-20">
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-[var(--pf-border)] pt-5 text-[16px] font-semibold text-[var(--pf-text-tertiary)]">
            <li className="w-full text-[14px] font-medium sm:w-auto">Works with</li>
            {WORKS_WITH.map((name) => <li key={name}>{name}</li>)}
            <li className="w-full text-[14px] font-medium sm:ml-auto sm:w-auto">Banks connect through Plaid</li>
          </ul>
        </section>

        <BankFlip id="why" />
        <SetupSteps id="how" />
        <Extras />
        <Trust />
        <PlanCards id="plans" onStart={() => void start()} />
        <Questions />

        <section className="mx-2 mt-20 rounded-[28px] bg-[var(--pf-agent)] text-[var(--pf-ink)] sm:mx-4 sm:mt-28 lg:mt-40 lg:rounded-[40px]">
          <div className="relative mx-auto w-full max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20 lg:py-28">
            <Reveal className="flex flex-col items-start gap-6">
              <h2 className="pf-hero-title max-w-[640px] font-serif">Your next budget builds itself.</h2>
              <button type="button" onClick={() => void start()} className="pf-btn pf-btn-primary h-[54px] px-6 text-[16px]">
                {GMAIL_READY ? <><GoogleMark /> Start with Google</> : 'See it work'}
              </button>
            </Reveal>
            <Reveal delay={0.15} className="absolute -top-10 right-16 hidden w-[290px] rotate-[4deg] drop-shadow-[0_18px_22px_rgba(28,27,27,0.28)] lg:block xl:right-28">
              <div aria-hidden className="pf-receipt px-6 pb-9 pt-6 text-[15px] leading-[1.5]">
                <p className="text-center text-[17px] font-bold tracking-wide">YOUR BUDGET</p>
                <p className="text-center text-[13px]">SET UP ONCE</p>
                <span className="my-3 block border-t border-dashed border-[var(--pf-text-tertiary)]" />
                {RECEIPT.map(([label, amount]) => <p key={label} className="flex justify-between gap-3"><span>{label}</span><span>{amount}</span></p>)}
                <span className="my-3 block border-t border-dashed border-[var(--pf-text-tertiary)]" />
                <p className="flex justify-between gap-3 text-[17px] font-bold"><span>LEFT</span><span>826.00</span></p>
                <p className="mt-3 text-center text-[13px]">ASKS ONLY WHEN UNSURE</p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-5 pb-[calc(24px+var(--pf-badge-room,0px))] pt-6 text-[14.5px] text-[var(--pf-text-secondary)] sm:px-8">
        <span className="flex items-center gap-2 text-[var(--pf-text-primary)]"><LogoMark size={18} /><span className="font-serif text-[18px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span></span>
        <span>Made in Ontario, Canada</span>
        <nav aria-label="Legal" className="flex items-center gap-5 sm:ml-auto">
          <Link href="/privacy" className="pf-link">Privacy</Link>
          <Link href="/terms" className="pf-link">Terms</Link>
        </nav>
      </footer>

      <AnimatePresence>
        {(waiting || message) && (
          <motion.p
            role={message ? 'alert' : 'status'}
            className={`fixed bottom-[calc(16px+var(--pf-badge-room,0px))] left-1/2 z-40 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full px-4 py-2.5 text-center text-[14.5px] font-medium leading-snug shadow-[0_12px_32px_rgba(28,27,27,0.24)] ${message ? 'bg-[var(--pf-warn)] text-white' : 'bg-[var(--pf-ink)] text-[var(--pf-ivory)]'}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            {message ?? 'Tick the email box on Google’s screen.'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
