import ProductShot from './ProductShot';
import Reveal from './Reveal';

const STEPS = [
  { tag: 'pf-tag-everyday', time: '10 seconds', title: 'Sign in with Google', detail: 'Read-only. Nothing to fill in.' },
  { tag: 'pf-tag-bills', time: 'A couple of minutes', title: 'It builds your budget', detail: 'From your last 90 days of receipts. Bills, everyday, and one-time buys kept apart.' },
  { tag: 'pf-tag-once', time: 'One click a day', title: 'It keeps up', detail: 'New purchases sort themselves. It only asks when it isn’t sure.' },
];

/** One sign-in, then the real product, drawn by the real code. */
export default function SetupSteps({ id }: { id: string }) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1320px] scroll-mt-20 px-5 pt-20 sm:px-8 sm:pt-28 lg:pt-36">
      <Reveal>
        <h2 className="pf-section-title max-w-[820px] font-serif">Set it up once. Then forget the setup.</h2>
      </Reveal>
      <ol className="mt-10 grid gap-x-10 gap-y-7 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.1}>
            <li className="list-none">
              <span className={`pf-tag ${step.tag}`}>{step.time}</span>
              <h3 className="mt-3 text-[20px] font-semibold">{step.title}</h3>
              <p className="mt-1 max-w-[360px] text-[16px] leading-snug text-[var(--pf-text-secondary)]">{step.detail}</p>
            </li>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-12 lg:mt-16">
        <ProductShot />
      </Reveal>
    </section>
  );
}
