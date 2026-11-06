'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatMoney } from '@/lib/money';
import { useMediaQuery } from '@/lib/use-media';
import CategoryIcon from '@/components/budget/CategoryIcon';
import { Ticking } from '@/components/ui/Ticking';

interface Receipt {
  store: string;
  lines: [string, string][];
  total: number;
  name: string;
  category: string;
  label: string;
  from: string;
  group: 'bill' | 'everyday' | 'once';
  /** A share of the total that renews by itself each month. */
  monthly?: number;
  /** Where it lands in the pile, as a share of the desk. */
  left: number;
  top: number;
  turn: number;
}

// A made-up family's month, spilled across the desk. The first few are all a phone has room for
const RECEIPTS: Receipt[] = [
  { store: 'COSTCO', lines: [['GROCERIES', '287.40'], ['HST', '14.22']], total: 301.62, name: 'Costco', category: 'groceries', label: 'Groceries', from: 'Gmail', group: 'everyday', left: 3, top: 5, turn: -9 },
  { store: 'NETFLIX', lines: [['STANDARD', '18.99'], ['HST', '2.47']], total: 21.46, name: 'Netflix', category: 'bills', label: 'Monthly', from: 'Gmail', group: 'bill', monthly: 21.46, left: 66, top: 4, turn: 7 },
  { store: 'TIM HORTONS', lines: [['COFFEE X2', '4.38'], ['BAGEL', '4.33'], ['HST', '1.13']], total: 9.84, name: 'Tim Hortons', category: 'eating', label: 'Eating out', from: 'Apple Wallet', group: 'everyday', left: 35, top: 13, turn: 4 },
  { store: 'BRIGHT PATH', lines: [['DAYCARE', '640.00']], total: 640, name: 'Bright Path Daycare', category: 'kids', label: 'Monthly', from: 'Gmail', group: 'bill', monthly: 640, left: 4, top: 40, turn: 6 },
  { store: 'AIR CANADA', lines: [['YYZ-YVR', '489.00'], ['TAX', '63.57']], total: 552.57, name: 'Air Canada', category: 'fun', label: 'Flight', from: 'Gmail', group: 'once', left: 37, top: 41, turn: -4 },
  { store: 'SHELL', lines: [['UNLEADED', '63.10'], ['HST', '8.20']], total: 71.3, name: 'Shell', category: 'transport', label: 'Transport', from: 'Apple Wallet', group: 'everyday', left: 67, top: 35, turn: -6 },
  { store: 'ROGERS', lines: [['MOBILE', '104.87'], ['HST', '13.63']], total: 118.5, name: 'Rogers', category: 'bills', label: 'Monthly', from: 'Gmail', group: 'bill', monthly: 118.5, left: 65, top: 62, turn: 5 },
  { store: 'APP STORE', lines: [['ANNUAL PLAN', '87.61'], ['HST', '11.39']], total: 99, name: 'Apple, annual plan', category: 'bills', label: 'Yearly', from: 'Gmail', group: 'bill', monthly: 8.25, left: 13, top: 64, turn: -12 },
];

const GROUPS: { id: Receipt['group']; title: string; note?: string }[] = [
  { id: 'bill', title: 'Bills' },
  { id: 'everyday', title: 'Everyday' },
  { id: 'once', title: 'One-time', note: 'Not in your budget' },
];

const FEW_RECEIPTS = 5;
const FILE_GAP_SECONDS = 0.1;
const ROW_DELAY_SECONDS = 0.24;

interface Flight {
  x: number;
  y: number;
  delay: number;
}

/** The whole product in one gesture: a messy pile becomes a budget. */
export default function ReceiptDesk() {
  const roomy = useMediaQuery('(min-width: 1024px)');
  const stillOnly = useReducedMotion();
  const receipts = roomy ? RECEIPTS : RECEIPTS.slice(0, FEW_RECEIPTS);

  const desk = useRef<HTMLDivElement>(null);
  const papers = useRef<(HTMLButtonElement | null)[]>([]);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const [flights, setFlights] = useState<Record<number, Flight>>({});
  const [spill, setSpill] = useState(0);

  const flightFor = useCallback((index: number, order: number): Flight | null => {
    const paper = papers.current[index];
    const row = rows.current[index];
    const room = desk.current;
    if (!paper || !row || !room) return null;
    const roomBox = room.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    return {
      x: rowBox.left - roomBox.left + 40 - (paper.offsetLeft + paper.offsetWidth / 2),
      y: rowBox.top - roomBox.top + rowBox.height / 2 - (paper.offsetTop + paper.offsetHeight / 2),
      delay: order * FILE_GAP_SECONDS,
    };
  }, []);

  const file = useCallback((index: number) => {
    const flight = flightFor(index, 0);
    if (flight) setFlights((current) => ({ ...current, [index]: flight }));
  }, [flightFor]);

  const fileAll = useCallback(() => {
    setFlights((current) => {
      const next = { ...current };
      receipts.forEach((_, index) => {
        if (next[index]) return;
        const flight = flightFor(index, Object.keys(next).length);
        if (flight) next[index] = flight;
      });
      return next;
    });
  }, [flightFor, receipts]);

  const spillAgain = useCallback(() => {
    setFlights({});
    setSpill((count) => count + 1);
  }, []);

  const filed = receipts.filter((_, index) => flights[index]);
  const allFiled = filed.length === receipts.length;
  const total = filed.reduce((sum, receipt) => sum + receipt.total, 0);
  const renewing = filed.reduce((sum, receipt) => sum + (receipt.monthly ?? 0), 0);

  return (
    <div ref={desk} className="relative h-full min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col rounded-[24px] bg-[var(--pf-ink)] px-4 pb-[66px] pt-4 text-[var(--pf-ivory)] shadow-[0_24px_60px_rgba(28,27,27,0.26)] sm:px-5 sm:pt-5">
        <div className={`flex shrink-0 items-end justify-between gap-3 transition-opacity duration-300 ${total > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div>
            <p className="text-[13px] text-[var(--pf-ivory-dim)]">This month</p>
            <p aria-live="polite" className="font-serif text-[clamp(34px,6vh,52px)] leading-none tracking-tight"><Ticking value={total} format={formatMoney} /></p>
          </div>
          {renewing > 0 && (
            <p className="pb-1 text-right text-[13px] leading-tight text-[var(--pf-ivory-dim)]"><span className="font-medium text-[var(--pf-ivory)]">{formatMoney(renewing)} a month</span><br />renews by itself</p>
          )}
        </div>

        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          {GROUPS.map((group) => {
            const members = receipts.flatMap((receipt, index) => (receipt.group === group.id ? [{ receipt, index }] : []));
            const started = members.some(({ index }) => flights[index]);
            return (
              <section key={group.id} className="flex min-h-0 flex-col" style={{ flex: `${members.length} 1 0%` }}>
                <h3 className={`flex shrink-0 items-baseline justify-between gap-3 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--pf-ivory-dim)] transition-opacity duration-300 ${started ? 'opacity-100' : 'opacity-0'}`}>
                  {group.title}
                  {group.note && <span className="font-medium normal-case tracking-normal">{group.note}</span>}
                </h3>
                <ol className="flex min-h-0 flex-1 flex-col">
                  {members.map(({ receipt, index }) => {
                    const flight = flights[index];
                    return (
                      <li key={receipt.store} ref={(element) => { rows.current[index] = element; }} className="flex min-h-0 flex-1 items-center gap-2.5 border-b border-[var(--pf-ink-line)] last:border-b-0">
                        {flight && (
                          <motion.span className="flex min-w-0 flex-1 items-center gap-2.5" initial={stillOnly ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', bounce: 0.2, duration: 0.5, delay: flight.delay + ROW_DELAY_SECONDS }}>
                            <CategoryIcon id={receipt.category} size={28} />
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block truncate text-[14px] font-medium">{receipt.name}</span>
                              <span className="block truncate text-[12px] text-[var(--pf-ivory-dim)]">{receipt.label} · {receipt.from}</span>
                            </span>
                            <span className="shrink-0 text-[14px] tabular-nums">{formatMoney(receipt.total)}</span>
                          </motion.span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </div>

      <div key={spill}>
        {receipts.map((receipt, index) => {
          const flight = flights[index];
          return (
            <motion.button
              key={receipt.store}
              ref={(element) => { papers.current[index] = element; }}
              type="button"
              aria-label={`File the ${receipt.name} receipt`}
              disabled={!!flight}
              drag={!flight}
              dragConstraints={desk}
              dragElastic={0.1}
              dragMomentum={false}
              onTap={() => file(index)}
              initial={stillOnly ? false : { opacity: 0, y: -60, rotate: receipt.turn * 2.5, scale: 1.1 }}
              animate={flight ? { x: flight.x, y: flight.y, rotate: 0, scale: 0.16, opacity: 0 } : { y: 0, rotate: receipt.turn, scale: 1, opacity: 1 }}
              whileHover={flight ? undefined : { scale: 1.05, rotate: receipt.turn / 3, zIndex: 20 }}
              whileDrag={{ scale: 1.1, rotate: 0, zIndex: 30, cursor: 'grabbing' }}
              transition={{ type: 'spring', stiffness: 190, damping: 22, delay: flight ? flight.delay : index * 0.06 }}
              className="absolute w-[clamp(118px,33%,168px)] cursor-grab touch-none text-left drop-shadow-[0_12px_14px_rgba(0,0,0,0.45)]"
              style={{ left: `${receipt.left}%`, top: `${receipt.top}%`, pointerEvents: flight ? 'none' : 'auto' }}
            >
              <span className="pf-receipt block px-3 pb-4 pt-3 text-[11px] leading-[1.35] text-[var(--pf-ink)] sm:text-[12px]">
                <span className="block text-center text-[13px] font-bold tracking-wide sm:text-[14px]">{receipt.store}</span>
                <span aria-hidden className="my-1.5 block border-t border-dashed border-[var(--pf-text-tertiary)]" />
                {receipt.lines.map(([item, price]) => (
                  <span key={item} className="flex justify-between gap-2"><span className="truncate">{item}</span><span>{price}</span></span>
                ))}
                <span aria-hidden className="my-1.5 block border-t border-dashed border-[var(--pf-text-tertiary)]" />
                <span className="flex justify-between gap-2 font-bold"><span>TOTAL</span><span>{receipt.total.toFixed(2)}</span></span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center">
        {allFiled ? (
          <button type="button" onClick={spillAgain} className="pointer-events-auto h-[46px] cursor-pointer rounded-full px-5 text-[14px] font-medium text-[var(--pf-ivory)] shadow-[inset_0_0_0_1px_var(--pf-ink-line)] transition-colors hover:bg-[var(--pf-ink-soft)]">Spill them again</button>
        ) : (
          <motion.button
            type="button"
            onClick={fileAll}
            className="pointer-events-auto h-[46px] cursor-pointer rounded-full bg-[var(--pf-agent)] px-6 text-[15px] font-semibold text-[var(--pf-ink)]"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            Sort this pile in one click
          </motion.button>
        )}
      </div>
    </div>
  );
}
