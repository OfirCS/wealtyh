'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Flame, Shield, Star } from 'lucide-react';
import type { Budget } from '@/lib/budget';
import { calendarFile, dailyFind, downloadCalendar, tomorrowLine } from '@/lib/comeback';
import { CARD_SPOTS, FULL_CARD_POINTS, pointsToday, punchesOnCard, readGoal, readPoints } from '@/lib/points';
import { playSound } from '@/lib/sounds';
import { localDay, readPace, readStreak } from '@/lib/streak';
import PointsSheet from './PointsSheet';
import PunchCard from './PunchCard';
import { CheckInSheet } from './CheckInSheet';

interface GameCardProps {
  budget: Budget | null;
  busy: boolean;
  /** How the last check-in went, while its result is showing. */
  checkIn: { found: number | null; problem: string | null } | null;
  onCheckIn: () => void;
  onCloseCheckIn: () => void;
}

/** One click a day punches the card. Seven punches pay out, and nothing here can be lost. */
export default function GameCard({ budget, busy, checkIn, onCheckIn, onCloseCheckIn }: GameCardProps) {
  const [showPoints, setShowPoints] = useState(false);
  const [today] = useState(() => localDay());

  const streak = useMemo(() => readStreak(budget?.checkIns, today), [budget, today]);
  const pace = useMemo(() => (budget?.categories.length ? readPace(budget, today) : null), [budget, today]);
  const points = useMemo(() => readPoints(budget), [budget]);
  const goal = useMemo(() => (budget ? readGoal(budget, today) : null), [budget, today]);
  const canCheckIn = !streak.checkedInToday || !budget?.transactions.length;
  const openPoints = () => { setShowPoints(true); playSound('tap'); };
  const title = streak.days > 0 ? `${streak.days}-day streak` : 'Start your streak';

  return (
    <section aria-label="Your streak" className="shrink-0 overflow-hidden rounded-[16px]">
      <div className="pf-punch pf-punch-card px-4 py-3 lg:p-4">
        <div className="flex items-center gap-2.5">
          <Flame strokeWidth={1.5} fill="currentColor" aria-hidden className="size-6 shrink-0" />
          <p aria-label={title} className="pf-title shrink-0">
            <span aria-hidden className="lg:hidden">{streak.days > 0 ? streak.days : 'Start'}</span>
            <span aria-hidden className="hidden lg:inline">{title}</span>
          </p>
          {streak.shields > 0 && <span aria-label={`${streak.shields} ${streak.shields === 1 ? 'shield' : 'shields'} ready`} className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold"><Shield size={13} strokeWidth={2.5} />{streak.shields}</span>}
          <div className="min-w-0 flex-1 lg:hidden"><PunchCard spots={CARD_SPOTS} punched={punchesOnCard(streak)} waiting={!streak.checkedInToday} reward={FULL_CARD_POINTS} /></div>
          {canCheckIn ? (
            <button type="button" disabled={busy} onClick={onCheckIn} className="pf-btn pf-btn-primary ml-auto h-9 shrink-0 rounded-[10px] px-3.5 text-[15px]">{busy ? 'Looking…' : 'Check in'}</button>
          ) : (
            <button type="button" aria-label={`${points.total.toLocaleString('en-CA')} points`} onClick={openPoints} className="ml-auto flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-[10px] bg-[var(--pf-ink)] px-3 text-[15px] font-bold text-[var(--pf-gold)]">
              <Star size={14} strokeWidth={2} fill="currentColor" aria-hidden />
              {points.total.toLocaleString('en-CA')}
            </button>
          )}
        </div>
        <div className="mt-2 hidden lg:block"><PunchCard spots={CARD_SPOTS} punched={punchesOnCard(streak)} waiting={!streak.checkedInToday} reward={FULL_CARD_POINTS} /></div>
      </div>

      <h2 className="sr-only">This week</h2>
      {goal && (
        <button type="button" aria-label="Your week and points" onClick={openPoints} className="pf-stub flex h-10 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left text-[13px]">
          <span className="min-w-0 truncate">{goal.over ? goal.next : goal.title}</span>
          {!goal.over && <span className="shrink-0 font-bold">{goal.short}</span>}
        </button>
      )}

      <AnimatePresence>
        {checkIn && (
          <CheckInSheet
            streak={streak}
            pace={pace}
            found={checkIn.found}
            problem={checkIn.problem}
            find={budget ? dailyFind(budget, today) : null}
            tomorrow={budget ? tomorrowLine(budget, today) : ''}
            earned={pointsToday(budget, today)}
            onRemind={() => { if (budget) downloadCalendar(calendarFile(budget, today, window.location.origin)); }}
            onClose={onCloseCheckIn}
          />
        )}
        {showPoints && <PointsSheet points={points} goal={goal} onClose={() => setShowPoints(false)} />}
      </AnimatePresence>
    </section>
  );
}
