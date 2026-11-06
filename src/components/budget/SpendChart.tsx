'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { DayPoint } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { useElementSize } from '@/lib/use-element-height';

interface SpendChartProps {
  /** One point for each day so far. */
  points: DayPoint[];
  /** How many days this month has. */
  days: number;
  planned: number;
  month: string;
  /** Called while moving along the line, and with null on leaving it. */
  onScrub?: (point: DayPoint | null) => void;
  showAxis?: boolean;
}

const TOP = 24;
const BOTTOM = 26;
const SIDE = 4;
const WEEK = 7;
/** Below this, a tick for every day turns into a smudge. */
const DAILY_TICKS_WIDTH = 480;

function dayLabel(month: string, day: number): string {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, day).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/** Money spent so far this month against an even pace. Move along it to see any day. */
export default function SpendChart({ points, days, planned, month, onScrub, showAxis = true }: SpendChartProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<DayPoint | null>(null);

  const bottom = showAxis ? BOTTOM : 4;
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const spent = points.at(-1)?.total ?? 0;
  const scale = Math.max(planned, spent, 1);
  const x = (day: number) => SIDE + ((day - 1) / Math.max(1, days - 1)) * (width - SIDE * 2);
  const y = (amount: number) => TOP + (1 - amount / scale) * (height - TOP - bottom);

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.day).toFixed(1)} ${y(point.total).toFixed(1)}`).join(' ');
  const lastPoint = points.at(-1);
  const over = spent > planned;
  const color = over ? 'var(--pf-warn)' : 'var(--pf-text-primary)';
  const marker = hover ?? lastPoint ?? null;

  const scrub = (clientX: number, left: number) => {
    const ratio = (clientX - left - SIDE) / Math.max(1, width - SIDE * 2);
    const day = Math.max(1, Math.min(points.length, Math.round(ratio * (days - 1)) + 1));
    const point = points[day - 1] ?? null;
    setHover(point);
    onScrub?.(point);
  };

  return (
    <div
      ref={ref}
      className="relative h-full min-h-0 w-full touch-none select-none"
      onPointerMove={(event) => scrub(event.clientX, event.currentTarget.getBoundingClientRect().left)}
      onPointerLeave={() => { setHover(null); onScrub?.(null); }}
    >
      {size.width > 0 && size.height > 0 && (
        <svg width={width} height={height} className="block" role="img" aria-label={`${formatMoney(spent)} spent so far, out of ${formatMoney(planned)}`}>
          <line x1={x(1)} x2={x(days)} y1={y(planned)} y2={y(planned)} stroke="var(--pf-border)" />
          <text x={x(days)} y={y(planned) - 7} fontSize="12" textAnchor="end" fill="var(--pf-text-tertiary)">{formatMoney(planned)} budget</text>
          <line x1={x(1)} y1={y(0)} x2={x(days)} y2={y(planned)} stroke="var(--pf-text-tertiary)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />

          {showAxis && Array.from({ length: days }, (_, index) => index + 1).map((day) => {
            const weekly = (day - 1) % WEEK === 0;
            if (!weekly && width < DAILY_TICKS_WIDTH) return null;
            return <line key={day} x1={x(day)} x2={x(day)} y1={height - bottom} y2={height - bottom + (weekly ? 6 : 3)} stroke={weekly ? 'var(--pf-text-tertiary)' : 'var(--pf-border)'} />;
          })}
          <line x1={x(1)} x2={x(days)} y1={height - bottom} y2={height - bottom} stroke="var(--pf-border)" />

          {line && <motion.path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ type: 'spring', bounce: 0, duration: 1.2 }} />}

          {hover && <line x1={x(hover.day)} x2={x(hover.day)} y1={TOP} y2={height - bottom} stroke="var(--pf-text-tertiary)" strokeWidth="1" />}
          {marker && <circle cx={x(marker.day)} cy={y(marker.total)} r="4" fill={color} stroke="var(--pf-bg-primary)" strokeWidth="2.5" />}

          {showAxis && (
            <>
              <text x={x(1)} y={height - 6} fontSize="12" fill="var(--pf-text-tertiary)">{dayLabel(month, 1)}</text>
              <text x={x(days)} y={height - 6} fontSize="12" textAnchor="end" fill="var(--pf-text-tertiary)">{dayLabel(month, days)}</text>
            </>
          )}
        </svg>
      )}
    </div>
  );
}
