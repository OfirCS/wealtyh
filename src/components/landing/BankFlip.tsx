'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { BadgeAlert, CalendarClock, ReceiptText, Search, Sofa, TrendingUp, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { playSound } from '@/lib/sounds';

interface Line {
  date: string;
  /** What the statement prints. A free trial isn't on it yet. */
  bank?: string;
  amount: string;
  icon: LucideIcon;
  /** Which of the app's colours it wears. */
  tint: string;
  ink: string;
  title: string;
  note: string;
  tag: string;
}

// A made-up family's month. The same seven rows, read two ways
const LINES: Line[] = [
  { date: 'NOV 01', bank: 'IKEA NORTH YORK ON', amount: '$1,240.00', icon: Sofa, tint: 'var(--pf-once)', ink: 'var(--pf-once-ink)', title: 'IKEA sofa', note: 'Left out of next month’s budget', tag: 'One-time' },
  { date: 'NOV 03', bank: 'AMZN MKTP CA*2K41L9', amount: '$84.12', icon: Undo2, tint: 'var(--pf-tint-sky)', ink: '#245F8C', title: 'Food storage set', note: 'Free return until Nov 14', tag: 'Return window' },
  { date: 'NOV 04', bank: 'APPLE.COM/BILL', amount: '$13.99', icon: Search, tint: 'var(--pf-everyday)', ink: 'var(--pf-everyday-ink)', title: 'iCloud+ 2 TB', note: 'What that Apple charge really was', tag: 'Real name' },
  { date: 'NOV 06', bank: 'NORTHSIDE FITNESS 4471', amount: '$54.00', icon: ReceiptText, tint: 'var(--pf-bills)', ink: 'var(--pf-bills-ink)', title: 'Northside Fitness', note: 'Monthly. Next one Dec 6', tag: 'Bill' },
  { date: 'NOV 07', bank: 'NORTHSIDE FITNESS 4471', amount: '$54.00', icon: BadgeAlert, tint: 'var(--pf-tint-blush)', ink: 'var(--pf-warn)', title: 'Charged you twice', note: 'Same gym, same amount, a day apart', tag: 'Double charge' },
  { date: 'NOV 09', bank: 'NETFLIX.COM', amount: '$20.99', icon: TrendingUp, tint: 'var(--pf-tint-peach)', ink: '#A9501C', title: 'Netflix costs more now', note: 'Up $2 a month', tag: 'Price rise' },
  { date: '', amount: '', icon: CalendarClock, tint: 'var(--pf-agent)', ink: 'var(--pf-ink)', title: 'Disney+ trial ends Friday', note: 'Then $14.99 a month', tag: 'Free trial' },
];

const STARTS_FLIPPING_MS = 700;
const FLAP_GAP_SECONDS = 0.075;

function Flap({ flipped, order, front, back }: { flipped: boolean; order: number; front: React.ReactNode; back: React.ReactNode }) {
  const stillOnly = useReducedMotion();
  return (
    <div className="pf-flap">
      <motion.div className="pf-flap-turn" animate={{ rotateX: flipped ? 180 : 0 }} transition={stillOnly ? { duration: 0 } : { type: 'spring', stiffness: 150, damping: 21, delay: order * FLAP_GAP_SECONDS }}>
        <div className="pf-flap-face" aria-hidden={flipped}>{front}</div>
        <div className="pf-flap-face pf-flap-back" aria-hidden={!flipped}>{back}</div>
      </motion.div>
    </div>
  );
}

function BankRow({ line }: { line: Line }) {
  if (!line.bank) return null;
  return (
    <div className="pf-mono flex h-full items-center gap-3 px-4 text-[13px] text-[#6B6963] sm:gap-5 sm:px-5 sm:text-[14.5px]">
      <span className="shrink-0">{line.date}</span>
      <span className="min-w-0 flex-1 truncate">{line.bank}</span>
      <span className="shrink-0 tabular-nums">{line.amount}</span>
    </div>
  );
}

function PathfinderRow({ line }: { line: Line }) {
  const Icon = line.icon;
  return (
    <div className="flex h-full items-center gap-3 px-4 sm:px-5">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: line.tint, color: line.ink }}>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[15.5px] font-semibold">{line.title}</span>
        <span className="block truncate text-[13.5px] text-[var(--pf-text-secondary)]">{line.note}</span>
      </span>
      <span className="hidden shrink-0 md:block"><span className="pf-tag" style={{ background: line.tint, color: line.ink }}>{line.tag}</span></span>
      {line.amount && <span className="w-[76px] shrink-0 text-right text-[15px] font-bold tabular-nums">{line.amount}</span>}
    </div>
  );
}

const VIEWS = [{ flipped: false, label: 'Your bank' }, { flipped: true, label: 'Pathfinder' }];

/** The whole argument in one gesture: the same month, as your bank prints it and as we read it. */
export default function BankFlip({ id }: { id: string }) {
  const statement = useRef<HTMLDivElement>(null);
  const seen = useInView(statement, { once: true, amount: 0.4 });
  const [turned, setTurned] = useState(false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const flipped = choice ?? turned;

  useEffect(() => {
    if (!seen) return;
    const timer = setTimeout(() => setTurned(true), STARTS_FLIPPING_MS);
    return () => clearTimeout(timer);
  }, [seen]);

  return (
    <section id={id} className="mx-2 scroll-mt-20 rounded-[28px] bg-[var(--pf-ink)] text-[var(--pf-ivory)] sm:mx-4 lg:rounded-[40px]">
      <div className="mx-auto grid w-full max-w-[1320px] items-center gap-x-16 gap-y-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-28">
        <div>
          <h2 className="pf-section-title font-serif">Your bank sees charges. <span className="text-[var(--pf-agent)]">We read the receipts.</span></h2>
          <p className="mt-4 max-w-[420px] text-[18px] leading-snug text-[var(--pf-ivory-dim)]">Same month, two stories.</p>
          <div role="group" aria-label="See this month as" className="mt-6 inline-flex rounded-full bg-[var(--pf-ink-soft)] p-1">
            {VIEWS.map((view) => {
              const active = view.flipped === flipped;
              return (
                <button key={view.label} type="button" aria-pressed={active} onClick={() => { setChoice(view.flipped); playSound('tap'); }} className={`relative h-10 cursor-pointer rounded-full px-5 text-[15px] font-semibold transition-colors ${active ? 'text-[var(--pf-ink)]' : 'text-[var(--pf-ivory-dim)] hover:text-[var(--pf-ivory)]'}`}>
                  {active && <motion.span layoutId="pf-flip-pill" className="absolute inset-0 rounded-full bg-[var(--pf-agent)]" transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }} />}
                  <span className="relative">{view.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={statement}>
          <div className="overflow-hidden rounded-[20px] bg-[var(--pf-bg-surface)] text-[var(--pf-text-primary)] shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
            <div className="h-[86px] border-b border-[var(--pf-border)]">
              <Flap
                flipped={flipped}
                order={0}
                front={(
                  <div className="pf-mono flex h-full items-center justify-between gap-3 px-4 text-[14px] text-[#6B6963] sm:px-5">
                    <span>CHEQUING ****4471</span>
                    <span>6 TRANSACTIONS</span>
                  </div>
                )}
                back={(
                  <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-5">
                    <p className="flex items-baseline gap-2">
                      <span className="font-serif text-[38px] leading-none tracking-tight">3</span>
                      <span className="text-[15px] font-semibold">things to check</span>
                    </p>
                  </div>
                )}
              />
            </div>
            <ol>
              {LINES.map((line, index) => (
                <li key={line.title} className="h-[68px] border-b border-[var(--pf-border)] last:border-b-0">
                  <Flap flipped={flipped} order={index + 1} front={<BankRow line={line} />} back={<PathfinderRow line={line} />} />
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-3 text-center text-[13px] text-[var(--pf-ivory-dim)]">A made-up family&rsquo;s month.</p>
        </div>
      </div>
    </section>
  );
}
