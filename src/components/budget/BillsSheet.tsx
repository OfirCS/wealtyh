'use client';

import { useMemo } from 'react';
import { deadlineTitle, monthlyRenewals, upcomingBills, upcomingDeadlines } from '@/lib/agent-insights';
import type { Budget } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import type { MonthPicture } from '@/lib/month-picture';
import Sheet from '@/components/ui/Sheet';
import { BillRow } from './Ledger';
import type { OpenMenu } from './Ledger';

const APPLE_SUBSCRIPTIONS = 'https://apps.apple.com/account/subscriptions';
const NEXT_SHOWN = 6;

function shortDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

interface BillsSheetProps {
  budget: Budget;
  picture: MonthPicture;
  month: string;
  today: string;
  onOpenPurchase: (id: string) => void;
  onMenu: OpenMenu;
  onClose: () => void;
}

/** Everything that runs by itself: this month's bills, then what's coming after. */
export default function BillsSheet({ budget, picture, month, today, onOpenPurchase, onMenu, onClose }: BillsSheetProps) {
  const bills = useMemo(() => [...picture.bills].sort((a, b) => Number(a.paid) - Number(b.paid) || a.date.localeCompare(b.date)), [picture.bills]);
  const future = useMemo(() => upcomingBills(budget, today), [budget, today]);
  const renewing = monthlyRenewals(future);
  const coming = useMemo(() => [
    ...upcomingDeadlines(budget, today).map((deadline) => ({ name: deadlineTitle(deadline), amount: deadline.amount, date: deadline.date })),
    ...future.filter((bill) => !bill.date.startsWith(month)).map((bill) => ({ name: bill.name, amount: bill.amount as number | undefined, date: bill.date })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, NEXT_SHOWN), [budget, future, month, today]);

  return (
    <Sheet title="Bills" onClose={onClose}>
      {renewing > 0 && <p className="mb-1 text-[15px] text-[var(--pf-text-secondary)]">{formatMoney(renewing)} a month renews by itself</p>}
      <ul>
        {bills.map((bill) => <BillRow key={bill.key} bill={bill} onOpenPurchase={onOpenPurchase} onMenu={onMenu} />)}
        {bills.length === 0 && <li className="py-2 text-[15px] text-[var(--pf-text-secondary)]">No regular bills yet.</li>}
      </ul>

      {coming.length > 0 && (
        <>
          <h3 className="pf-label mt-4">Coming up</h3>
          <ul>
            {coming.map((item) => (
              <li key={`${item.name}-${item.date}`} className="group pf-row">
                <span className="w-[52px] shrink-0 text-[13px] tabular-nums text-[var(--pf-text-tertiary)]">{shortDay(item.date)}</span>
                <span className="min-w-0 flex-1 truncate text-[15px]">{item.name}</span>
                {item.name.startsWith('Apple') && <a href={APPLE_SUBSCRIPTIONS} target="_blank" rel="noreferrer" className="pf-link shrink-0 text-[13px] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">Manage</a>}
                {item.amount !== undefined && <span className="shrink-0 text-[15px] font-bold tabular-nums">{formatMoney(item.amount)}</span>}
                <span aria-hidden className="pf-rule pf-rule-flat" />
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
