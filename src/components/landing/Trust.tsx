import { EyeOff, HandCoins, KeyRound, ShieldOff } from 'lucide-react';
import Reveal from './Reveal';

const PROMISES = [
  { icon: HandCoins, title: 'Read-only', detail: 'It can’t move a cent.' },
  { icon: KeyRound, title: 'No bank password', detail: 'Your login stays with Plaid.' },
  { icon: EyeOff, title: 'No ads, no selling', detail: 'Your data is not the product.' },
  { icon: ShieldOff, title: 'No AI training', detail: 'Your money stays yours.' },
];

export default function Trust() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-5 pt-20 sm:px-8 sm:pt-28 lg:pt-36">
      <Reveal>
        <h2 className="pf-section-title font-serif">It can look. It can&rsquo;t touch.</h2>
      </Reveal>
      <ul className="mt-9 grid gap-x-8 gap-y-6 border-t border-[var(--pf-text-primary)] pt-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map(({ icon: Icon, title, detail }, index) => (
          <Reveal key={title} delay={index * 0.07}>
            <li className="list-none">
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <h3 className="mt-2.5 text-[18px] font-semibold">{title}</h3>
              <p className="text-[16px] text-[var(--pf-text-secondary)]">{detail}</p>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
