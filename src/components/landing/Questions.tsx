import { Plus } from 'lucide-react';
import Reveal from './Reveal';

const QUESTIONS = [
  ['Can Pathfinder move my money?', 'No. It’s read-only. It sees your transactions and money emails, and it can’t act on them.'],
  ['Do I have to connect my bank?', 'No. Gmail builds your budget from receipts and bank alerts. Your bank fills in what email misses.'],
  ['Does it read all my email?', 'No. Google’s permission covers your inbox, but it only opens emails that look like receipts, refunds or bank alerts. We don’t keep the text.'],
  ['How does Apple Pay work?', 'A one-time iPhone shortcut sends each tap, so it shows up within a minute. Turn it off any time.'],
  ['Can I add my partner’s inbox?', 'Yes. Family adds up to 4 inboxes to your budget.'],
];

export default function Questions() {
  return (
    <section className="mx-auto grid w-full max-w-[1320px] gap-x-16 gap-y-8 px-5 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-36">
      <Reveal>
        <h2 className="pf-section-title font-serif">Good questions.</h2>
      </Reveal>
      <div className="border-t border-[var(--pf-text-primary)]">
        {QUESTIONS.map(([question, answer]) => (
          <details key={question} className="pf-question group border-b border-[var(--pf-border)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[18px] font-semibold">
              {question}
              <Plus size={20} aria-hidden className="shrink-0 transition-transform duration-200 group-open:rotate-45" />
            </summary>
            <p className="max-w-[560px] pb-4 text-[16.5px] leading-snug text-[var(--pf-text-secondary)]">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
