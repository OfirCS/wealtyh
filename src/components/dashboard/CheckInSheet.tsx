'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Flame, Shield, Star } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { CARD_SPOTS, FULL_CARD_POINTS, punchesOnCard } from '@/lib/points';
import type { Pace, Streak } from '@/lib/streak';
import { playSound } from '@/lib/sounds';
import Sheet from '@/components/ui/Sheet';
import PunchCard from './PunchCard';

const DAYS_PER_SHIELD = 7;

interface CheckInSheetProps {
  streak: Streak;
  pace: Pace | null;
  /** New purchases brought in, or null if the agent couldn't look. */
  found: number | null;
  problem: string | null;
  /** Something new from their own numbers, different each day. */
  find: string | null;
  /** A real reason to come back tomorrow. */
  tomorrow: string;
  /** Points this check-in earned. */
  earned: number;
  onRemind: () => void;
  onClose: () => void;
}

/** Answers one question: how did it go? A bad day gets kindness, because you still showed up. */
export function CheckInSheet({ streak, pace, found, problem, find, tomorrow, earned, onRemind, onClose }: CheckInSheetProps) {
  const [reminded, setReminded] = useState(false);
  const earnedShield = streak.days > 0 && streak.days % DAYS_PER_SHIELD === 0;
  const yesterday = !pace ? null : pace.yesterday >= 0 ? `Yesterday: ${formatMoney(pace.yesterday)} under.` : `Yesterday: ${formatMoney(-pace.yesterday)} over. Still counts.`;
  const news = found === null ? problem : found > 0 ? `${found} new.` : null;

  useEffect(() => {
    if (find) playSound('found');
  }, [find]);

  return (
    <Sheet title="Checked in" hideTitle onClose={onClose}>
      <div className="pf-punch rounded-[16px] p-4 pr-5 [--pf-spot:30px]">
        <p className="pf-number flex items-center gap-2"><Flame size={28} strokeWidth={1.5} fill="currentColor" aria-hidden />Day {streak.days}</p>
        <div className="mt-3 max-w-[280px]"><PunchCard spots={CARD_SPOTS} punched={punchesOnCard(streak)} waiting={false} reward={FULL_CARD_POINTS} stampLatest /></div>
        {(earned > 0 || earnedShield) && (
          <p className="mt-3 flex flex-wrap items-center gap-2">
            {earned > 0 && <span className="flex h-7 items-center gap-1 rounded-full bg-[var(--pf-ink)] px-2.5 text-[15px] font-bold text-[var(--pf-gold)]"><Star size={14} fill="currentColor" aria-hidden />+{earned} points</span>}
            {earnedShield && <span className="flex items-center gap-1 text-[15px] font-bold"><Shield size={15} strokeWidth={2.25} /> Shield earned</span>}
          </p>
        )}
      </div>

      {(news || yesterday) && (
        <p className="mt-3 text-[15px] text-[var(--pf-text-secondary)]">{[news, yesterday].filter(Boolean).join(' ')}</p>
      )}
      {find && (
        <motion.p className="mt-3 rounded-[10px] bg-[var(--pf-agent)] px-3.5 py-3 text-[15px] font-bold leading-snug text-[var(--pf-ink)]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.2, duration: 0.5, delay: 0.2 }}>{find}</motion.p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] leading-snug text-[var(--pf-text-secondary)]">{tomorrow}</p>
        {reminded
          ? <span className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-[var(--pf-good)]"><Check size={15} strokeWidth={2.5} /> Added</span>
          : <button type="button" className="pf-link shrink-0 text-[15px]" onClick={() => { onRemind(); setReminded(true); }}>Remind me</button>}
      </div>
    </Sheet>
  );
}
