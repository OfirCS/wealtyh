'use client';

import { useMemo } from 'react';
import { autoBudget, importStatement, monthKey, monthLabel, sortTransfersToPeople } from '@/lib/budget';
import type { Budget } from '@/lib/budget';
import { monthPicture } from '@/lib/month-picture';
import { sampleStatement } from '@/lib/sample-statement';
import { DEMO_SESSION } from '@/lib/session';
import { parseStatement } from '@/lib/statement';
import { addDays, localDay } from '@/lib/streak';
import { MonthHero, MonthLedger } from '@/components/budget/Ledger';
import GameCard from '@/components/dashboard/GameCard';
import TodayCard from '@/components/dashboard/TodayCard';
import AgentLight from '@/components/ui/AgentLight';
import { LogoMark } from '@/components/ui/Logo';

const nothing = () => undefined;
const STREAK_SHOWN = 4;
const POINTS_SHOWN = 140;

function sampleBudget(today: string): Budget {
  const { budget } = importStatement(parseStatement(sampleStatement(new Date())), null, 0, 'mail');
  const checkIns = Array.from({ length: STREAK_SHOWN }, (_, index) => addDays(today, index - STREAK_SHOWN));
  return { ...autoBudget(sortTransfersToPeople(budget)), checkIns, pointsEarlier: POINTS_SHOWN };
}

/** The real screen with a made-up family's money. It can't be touched, only looked at. */
export default function ProductShot() {
  const today = useMemo(() => localDay(), []);
  const month = useMemo(() => monthKey(new Date()), []);
  const budget = useMemo(() => sampleBudget(today), [today]);
  const picture = useMemo(() => monthPicture(budget, month, today), [budget, month, today]);

  return (
    <figure aria-label="Pathfinder's budget screen, with a made-up family's money" className="pf-shot">
      <div inert aria-hidden className="pointer-events-none">
        <div className="grid h-[60px] grid-cols-[1fr_auto_1fr] items-center px-6 text-[15px] font-medium">
          <span className="flex items-center gap-2.5">
            <LogoMark size={20} />
            <span className="font-serif text-[20px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
          </span>
          <span className="hidden gap-8 sm:flex">
            <span className="underline decoration-2 underline-offset-[10px]">Month</span>
            <span className="text-[var(--pf-text-tertiary)]">Year</span>
            <span className="text-[var(--pf-text-tertiary)]">Purchases</span>
          </span>
          <span className="flex items-center justify-end gap-2"><AgentLight /> Ask</span>
        </div>
        <div className="flex flex-col px-4 pb-6 font-medium lg:px-6">
          <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-8">
            <div className="order-1 lg:order-none">
              <p className="mb-1 text-[15px] font-bold">{monthLabel(month).split(' ')[0]}</p>
              <MonthHero picture={picture} month={month} today={today} />
            </div>
            <div className="order-3 mt-2 lg:order-none lg:mt-0"><GameCard budget={budget} busy={false} checkIn={null} onCheckIn={nothing} onCloseCheckIn={nothing} /></div>
          </div>
          <div className="order-2 mt-2 lg:order-none"><TodayCard session={DEMO_SESSION} budget={budget} month={month} working={false} isSample={false} onChoose={nothing} onSetIncome={nothing} /></div>
          <div className="order-4 mt-3 lg:order-none lg:mt-2"><MonthLedger picture={picture} fillKey={0} onOpenCategory={nothing} onOpenBills={nothing} onOpenOneTime={nothing} onOpenPurchase={nothing} onMenu={nothing} /></div>
        </div>
      </div>
    </figure>
  );
}
