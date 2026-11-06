import {
  ArrowLeftRight, Baby, Banknote, Car, Coffee, CreditCard, Dog, Dumbbell, Fuel, Gift, GraduationCap, HandHeart, HeartPulse, House,
  PiggyBank, Plane, ReceiptText, Repeat, Send, Shapes, Shirt, ShieldCheck, ShoppingBag, ShoppingBasket, Smartphone, Tag, Ticket, UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CategoryStyle {
  icon: LucideIcon;
  tint: string;
}

const KNOWN: Record<string, CategoryStyle> = {
  housing: { icon: House, tint: 'var(--pf-tint-periwinkle)' },
  groceries: { icon: ShoppingBasket, tint: 'var(--pf-tint-sage)' },
  bills: { icon: ReceiptText, tint: 'var(--pf-tint-butter)' },
  transport: { icon: Car, tint: 'var(--pf-tint-sky)' },
  kids: { icon: Baby, tint: 'var(--pf-tint-peach)' },
  health: { icon: HeartPulse, tint: 'var(--pf-tint-blush)' },
  eating: { icon: UtensilsCrossed, tint: 'var(--pf-tint-apricot)' },
  shopping: { icon: ShoppingBag, tint: 'var(--pf-tint-lilac)' },
  fun: { icon: Ticket, tint: 'var(--pf-tint-mint)' },
  debt: { icon: CreditCard, tint: 'var(--pf-tint-stone)' },
  people: { icon: Send, tint: 'var(--pf-tint-sky)' },
  once: { icon: Tag, tint: 'var(--pf-once)' },
  other: { icon: Shapes, tint: 'var(--pf-tint-stone)' },
  transfer: { icon: ArrowLeftRight, tint: 'var(--pf-tint-stone)' },
  income: { icon: Banknote, tint: 'var(--pf-tint-mint)' },
};

// Categories people add themselves still get a fitting symbol
const BY_WORD: [RegExp, LucideIcon, string][] = [
  [/pet|dog|cat|vet/i, Dog, 'var(--pf-tint-apricot)'],
  [/travel|trip|vacation|flight|holiday/i, Plane, 'var(--pf-tint-sky)'],
  [/gift|birthday|present/i, Gift, 'var(--pf-tint-blush)'],
  [/saving|rrsp|tfsa|fhsa|invest/i, PiggyBank, 'var(--pf-tint-sage)'],
  [/school|tuition|education|class|lesson/i, GraduationCap, 'var(--pf-tint-periwinkle)'],
  [/gym|fitness|sport|yoga/i, Dumbbell, 'var(--pf-tint-mint)'],
  [/cloth|fashion|shoes/i, Shirt, 'var(--pf-tint-lilac)'],
  [/phone|mobile|internet/i, Smartphone, 'var(--pf-tint-butter)'],
  [/insur/i, ShieldCheck, 'var(--pf-tint-sky)'],
  [/subscri|stream|member/i, Repeat, 'var(--pf-tint-butter)'],
  [/coffee|cafe/i, Coffee, 'var(--pf-tint-apricot)'],
  [/charit|donat/i, HandHeart, 'var(--pf-tint-blush)'],
  [/gas|fuel/i, Fuel, 'var(--pf-tint-sky)'],
];

function styleFor(id: string): CategoryStyle {
  const known = KNOWN[id];
  if (known) return known;
  const match = BY_WORD.find(([pattern]) => pattern.test(id));
  return match ? { icon: match[1], tint: match[2] } : { icon: Tag, tint: 'var(--pf-tint-stone)' };
}

/** Plain is the line icon alone, for lists where colour would be noise. */
export default function CategoryIcon({ id, size = 28, plain = false }: { id: string; size?: number; plain?: boolean }) {
  const { icon: Icon, tint } = styleFor(id);
  if (plain) return <Icon aria-hidden size={size} strokeWidth={1.75} className="shrink-0 text-[var(--pf-text-secondary)]" />;
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full text-[var(--pf-text-primary)]" style={{ width: size, height: size, background: tint }}>
      <Icon size={Math.round(size * 0.54)} strokeWidth={1.75} />
    </span>
  );
}
