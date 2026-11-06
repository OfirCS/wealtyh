'use client';

import { Star } from 'lucide-react';
import { EARNING } from '@/lib/points';
import type { GoalProgress, PointsSummary } from '@/lib/points';
import Sheet from '@/components/ui/Sheet';

function shortDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const RECENT_SHOWN = 3;

/** The whole game in one place: where you are, this week's goal, and how it all adds up. */
export default function PointsSheet({ points, goal, onClose }: { points: PointsSummary; goal: GoalProgress | null; onClose: () => void }) {
  return (
    <Sheet title="Your points" onClose={onClose}>
      <div className="pf-punch rounded-[16px] p-4">
        <p className="pf-number flex items-center gap-2"><Star size={26} fill="currentColor" strokeWidth={1.5} aria-hidden />{points.total.toLocaleString('en-CA')}</p>
        <p className="mt-0.5 text-[15px] font-bold">Level {points.level} · {points.name}</p>
        <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-[rgba(28,27,27,0.16)]">
          <span className="block h-full rounded-full bg-[var(--pf-ink)]" style={{ width: `${Math.max(points.share * 100, 2)}%` }} />
        </span>
        {points.next && <p className="mt-1.5 text-[13px] font-medium">{points.next.toGo.toLocaleString('en-CA')} to {points.next.name}</p>}
      </div>

      {goal && (
        <div className="mt-3 flex items-center justify-between gap-3 border-b border-[var(--pf-border)] pb-3">
          <span className="min-w-0 leading-tight">
            <span className="block text-[15px] font-bold">{goal.over ? goal.next : goal.title}</span>
            {!goal.over && <span className="text-[13px] tabular-nums text-[var(--pf-text-tertiary)]">{goal.detail}</span>}
          </span>
          {!goal.over && <span className="shrink-0 text-[15px] font-bold">+{goal.reward}</span>}
        </div>
      )}

      {points.recent.length > 0 && (
        <ul className="mt-2">
          {points.recent.slice(0, RECENT_SHOWN).map((entry) => (
            <li key={entry.id} className="flex items-baseline gap-3 py-1 text-[15px]">
              <span className="w-[3.25rem] shrink-0 text-[13px] tabular-nums text-[var(--pf-text-tertiary)]">{shortDay(entry.date)}</span>
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              <span className="shrink-0 font-bold tabular-nums text-[var(--pf-good)]">+{entry.points}</span>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-2 border-t border-[var(--pf-border)]">
        <summary className="flex h-11 cursor-pointer list-none items-center text-[15px] font-bold">How to earn</summary>
        <ul className="pb-1">
          {EARNING.map((item) => (
            <li key={item.label} className="flex items-baseline justify-between gap-3 py-1 text-[15px]">
              {item.label}
              <span className="shrink-0 font-bold tabular-nums">+{item.points} <span className="text-[13px] text-[var(--pf-text-tertiary)]">{item.per}</span></span>
            </li>
          ))}
        </ul>
      </details>
    </Sheet>
  );
}
