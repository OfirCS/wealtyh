'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { askAboutMoney, readAnswer } from '@/lib/budget-agent';
import type { Budget } from '@/lib/budget';
import { playSound } from '@/lib/sounds';
import AgentLight from '@/components/ui/AgentLight';
import Sheet from '@/components/ui/Sheet';

const STARTERS = ['Spent on Amazon this month?', 'What can I cancel?', 'Biggest change this month?'];

/** Ask anything. Receipts know what was bought, so this goes further than a bank app can. */
export default function AskSheet({ budget, onPlan, onClose }: { budget: Budget; onPlan: () => void; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = async (text: string) => {
    if (!text.trim() || thinking) return;
    setAsked(text);
    setAnswer(null);
    setQuestion('');
    setThinking(true);
    playSound('tap');
    setAnswer(await askAboutMoney(budget, text));
    setThinking(false);
    playSound('success');
  };

  const reply = answer === null ? null : readAnswer(answer);

  return (
    <Sheet title="Ask" onClose={onClose}>
      <form className="flex h-12 items-center gap-2.5 rounded-[12px] bg-[var(--pf-bg-primary)] pl-3.5 pr-2 focus-within:shadow-[inset_0_0_0_1px_var(--pf-text-primary)]" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
        <AgentLight working={thinking} />
        <input
          aria-label="Your question"
          autoFocus
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your money"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--pf-text-tertiary)]"
        />
        <button type="submit" aria-label="Ask" disabled={!question.trim() || thinking} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] bg-[var(--pf-ink)] text-[var(--pf-ivory)] disabled:cursor-default disabled:opacity-25"><ArrowUp size={16} /></button>
      </form>

      {asked ? (
        <div className="mt-4 min-h-[92px]">
          <p className="text-[15px] font-medium text-[var(--pf-text-secondary)]">{asked}</p>
          <div className="mt-2 rounded-[14px] bg-[var(--pf-bg-primary)] p-4" role="status">
            {thinking && <span aria-label="Thinking" className="pf-tape-cursor" />}
            {!thinking && reply?.figure && <p className="pf-number">{reply.figure}</p>}
            {!thinking && reply && <p className={`text-[15px] leading-snug ${reply.figure ? 'mt-1 text-[var(--pf-text-secondary)]' : ''}`}>{reply.words}</p>}
          </div>
        </div>
      ) : (
        <ul className="mt-2">
          {STARTERS.map((starter) => (
            <li key={starter} className="border-b border-[var(--pf-border)]">
              <button type="button" className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 text-left text-[15px] transition-colors hover:bg-[var(--pf-bg-hover)]" onClick={() => void ask(starter)}>
                {starter}
                <ArrowRight size={14} className="shrink-0 text-[var(--pf-text-tertiary)]" aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 text-left text-[15px] font-medium transition-colors hover:bg-[var(--pf-bg-hover)]" onClick={onPlan}>
              Make a plan
              <ArrowRight size={14} className="shrink-0" aria-hidden />
            </button>
          </li>
        </ul>
      )}
    </Sheet>
  );
}
