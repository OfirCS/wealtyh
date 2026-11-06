'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Flame, Star } from 'lucide-react';
import { playSound } from '@/lib/sounds';
import { CARD_SPOTS, FULL_CARD_POINTS } from '@/lib/points';
import PunchCard from '@/components/dashboard/PunchCard';
import { Ticking } from '@/components/ui/Ticking';
import Reveal from './Reveal';

const CHECK_IN_POINTS = 10;
const START_PUNCHES = 4;
const START_POINTS = 140;

function Card({ title, detail, className = '', children }: { title: string; detail: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative flex h-full min-h-[310px] flex-col justify-between gap-7 rounded-[24px] p-6 sm:p-8 ${className}`}>
      <div>
        <h3 className="font-serif text-[clamp(28px,3vw,38px)] leading-[1.05] tracking-tight">{title}</h3>
        <p className="mt-2 max-w-[420px] text-[16.5px] leading-snug">{detail}</p>
      </div>
      {children}
    </div>
  );
}

/** Try the streak right here. */
function StreakCard() {
  const [punched, setPunched] = useState(START_PUNCHES);
  const [points, setPoints] = useState(START_POINTS);

  const checkIn = () => {
    const next = punched >= CARD_SPOTS ? 1 : punched + 1;
    setPunched(next);
    setPoints((current) => current + CHECK_IN_POINTS + (next === CARD_SPOTS ? FULL_CARD_POINTS : 0));
    playSound(next === CARD_SPOTS ? 'success' : 'pop');
  };

  return (
    <Card className="pf-punch" title="A bad day can’t break your streak." detail="It counts looking, not spending. Fill the card, earn the points.">
      <span className="absolute right-6 top-6 flex h-9 items-center gap-1.5 rounded-full bg-[var(--pf-ink)] px-3.5 text-[16px] font-bold text-[var(--pf-gold)] sm:right-8 sm:top-8">
        <Star size={15} strokeWidth={2} fill="currentColor" aria-hidden />
        <span className="sr-only">Points: </span>{points}
      </span>
      <div className="pf-punch-large flex flex-wrap items-center justify-between gap-x-5 gap-y-4">
        <div className="min-w-[250px] max-w-[420px] flex-1"><PunchCard spots={CARD_SPOTS} punched={punched} waiting={punched < CARD_SPOTS} reward={FULL_CARD_POINTS} /></div>
        <button type="button" onClick={checkIn} className="pf-btn pf-btn-primary h-12 rounded-[13px] px-5 text-[15.5px]"><Flame size={16} fill="currentColor" aria-hidden /> Check in</button>
      </div>
    </Card>
  );
}

const SIGHTINGS = [
  { from: 'Gmail', name: 'Tim Hortons receipt' },
  { from: 'Apple Pay', name: 'Tim Hortons' },
  { from: 'Bank', name: 'TIM HORTONS #2241' },
];
const ROW_STEP = 50;

/** Three sources see one coffee. They fall together into one line. */
function CountedOnceCard() {
  const box = useRef<HTMLDivElement>(null);
  const seen = useInView(box, { once: true, amount: 0.7 });
  const stillOnly = useReducedMotion();
  const together = seen || !!stillOnly;

  return (
    <Card className="bg-[var(--pf-everyday)]" title="Counted once." detail="Gmail, your bank and Apple Pay all see the same coffee. You still only bought one.">
      <div ref={box} className="relative h-[140px]">
        {SIGHTINGS.map((sighting, index) => (
          <motion.div key={sighting.from} className="absolute inset-x-0 top-0 flex h-[42px] items-center gap-2.5 rounded-[12px] bg-[var(--pf-bg-surface)] px-3" initial={{ y: index * ROW_STEP }} animate={together ? { y: ROW_STEP, opacity: 0, scale: 0.96 } : { y: index * ROW_STEP }} transition={{ type: 'spring', bounce: 0.1, duration: 0.8, delay: 0.5 + index * 0.08 }}>
            <span className="pf-tag pf-tag-everyday shrink-0">{sighting.from}</span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{sighting.name}</span>
            <span className="shrink-0 text-[14px] font-semibold tabular-nums">$9.84</span>
          </motion.div>
        ))}
        <motion.div className="absolute inset-x-0 flex h-[54px] items-center gap-3 rounded-[14px] bg-[var(--pf-ink)] px-4 text-[var(--pf-ivory)]" style={{ top: ROW_STEP - 6 }} initial={{ opacity: 0, scale: 0.9 }} animate={together ? { opacity: 1, scale: 1 } : {}} transition={{ type: 'spring', bounce: 0.3, duration: 0.6, delay: 0.95 }}>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15px] font-semibold">Tim Hortons</span>
            <span className="block truncate text-[12.5px] text-[var(--pf-ivory-dim)]">Seen 3 times. Counted once.</span>
          </span>
          <span className="shrink-0 text-[15px] font-bold tabular-nums">$9.84</span>
        </motion.div>
      </div>
    </Card>
  );
}

const WITH_CENTS = (value: number) => `$${value.toFixed(2)}`;
const BEFORE_THE_TAP = 80;
const AFTER_THE_TAP = 70.16;

/** A tap lands while you watch. */
function LiveCard() {
  const box = useRef<HTMLDivElement>(null);
  const seen = useInView(box, { once: true, amount: 0.7 });
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    if (!seen) return;
    const timer = setTimeout(() => setTapped(true), 900);
    return () => clearTimeout(timer);
  }, [seen]);

  return (
    <Card className="bg-[var(--pf-tint-sky)]" title="Live with Apple Pay." detail="Tap your phone. It’s in your budget within a minute.">
      <div ref={box}>
        <p className="text-[14px] font-semibold">Eating out</p>
        <p className="font-serif text-[46px] leading-none tracking-tight"><Ticking value={tapped ? AFTER_THE_TAP : BEFORE_THE_TAP} format={WITH_CENTS} /> <span className="font-sans text-[17px] font-semibold tracking-normal">left</span></p>
        <motion.p className="mt-3 flex items-center gap-2 text-[14px]" initial={{ opacity: 0, y: 8 }} animate={tapped ? { opacity: 1, y: 0 } : {}} transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}>
          <span className="pf-tag bg-[var(--pf-bg-surface)]">Just now</span>
          Tim Hortons, $9.84
        </motion.p>
      </div>
    </Card>
  );
}

function AskCard() {
  return (
    <Card className="bg-[var(--pf-once)]" title="Ask it anything." detail="About your own money, in your own words.">
      <div className="flex flex-col gap-2 text-[16px] leading-snug">
        <p className="ml-auto max-w-[85%] rounded-[16px] rounded-br-[5px] bg-[var(--pf-ink)] px-3.5 py-2.5 text-[var(--pf-ivory)]">Spent on Amazon this month?</p>
        <p className="mr-auto max-w-[85%] rounded-[16px] rounded-bl-[5px] bg-[var(--pf-bg-surface)] px-3.5 py-2.5"><strong>$142.</strong> Three orders. The biggest was $84.</p>
      </div>
    </Card>
  );
}

/** The rest of what a statement can't do. */
export default function Extras() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-5 pt-20 sm:px-8 sm:pt-28 lg:pt-36">
      <Reveal>
        <h2 className="pf-section-title max-w-[820px] font-serif">Everything else a statement can&rsquo;t do.</h2>
      </Reveal>
      <div className="mt-10 grid gap-3.5 lg:grid-cols-12">
        <Reveal className="lg:col-span-7"><StreakCard /></Reveal>
        <Reveal className="lg:col-span-5" delay={0.08}><CountedOnceCard /></Reveal>
        <Reveal className="lg:col-span-5"><LiveCard /></Reveal>
        <Reveal className="lg:col-span-7" delay={0.08}><AskCard /></Reveal>
      </div>
    </section>
  );
}
