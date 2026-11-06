import { Check } from 'lucide-react';
import { PLANS } from '@/core/plans';
import { formatMoney } from '@/lib/money';
import Reveal from './Reveal';

const FREE = ['Gmail receipts', 'Apple Pay taps', 'Your budget', 'Return and trial deadlines', 'Streaks and points', '5 questions a day'];
const FAMILY = ['Everything in Free', 'Up to 5 bank logins', 'Up to 4 inboxes', '50 questions a day'];

interface PlanProps {
  name: string;
  price: string;
  per: string;
  items: string[];
  action: string;
  onStart: () => void;
  lead?: boolean;
}

function Plan({ name, price, per, items, action, onStart, lead = false }: PlanProps) {
  return (
    <div className={`flex h-full flex-col rounded-[24px] p-6 sm:p-8 ${lead ? 'bg-[var(--pf-ink)] text-[var(--pf-ivory)]' : 'bg-[var(--pf-bg-surface)] shadow-[inset_0_0_0_1px_var(--pf-border)]'}`}>
      <h3 className="text-[18px] font-semibold">{name}</h3>
      <p className="mt-2 font-serif text-[56px] leading-none tracking-tight">
        {price}
        <span className="ml-2 font-sans text-[16px] tracking-normal opacity-70">{per}</span>
      </p>
      <ul className="mb-6 mt-5 flex flex-col gap-2 text-[16px]">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <Check size={17} strokeWidth={2.5} className={`mt-[3px] shrink-0 ${lead ? 'text-[var(--pf-agent)]' : 'text-[var(--pf-good)]'}`} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onStart} className={`pf-btn mt-auto h-12 w-full text-[15.5px] ${lead ? 'pf-btn-agent' : 'pf-btn-primary'}`}>{action}</button>
    </div>
  );
}

export default function PlanCards({ id, onStart }: { id: string; onStart: () => void }) {
  const { monthlyCents, yearlyCents } = PLANS.family;
  return (
    <section id={id} className="mx-auto grid w-full max-w-[1320px] scroll-mt-20 gap-x-16 gap-y-8 px-5 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-36">
      <Reveal>
        <h2 className="pf-section-title font-serif">Free for good. Family if you want more.</h2>
      </Reveal>
      <div>
        <div className="grid gap-3.5 md:grid-cols-2">
          <Reveal><Plan name="Free" price="$0" per="for good" items={FREE} action="Start free" onStart={onStart} /></Reveal>
          <Reveal delay={0.08}><Plan name="Family" price={`$${(monthlyCents / 100).toFixed(2)}`} per="a month" items={FAMILY} action="Start free" onStart={onStart} lead /></Reveal>
        </div>
        <p className="mt-3 text-[14px] text-[var(--pf-text-tertiary)]">Family opens soon, and until then everyone gets it for free. {formatMoney(yearlyCents / 100)} a year if you pay yearly. Canadian dollars.</p>
      </div>
    </section>
  );
}
