'use client';

import { AnimatePresence, motion } from 'framer-motion';

export interface AgentStep {
  id: string;
  label: string;
  status: 'active' | 'complete';
  detail?: string;
}

/** The agent prints its work as it goes. Used everywhere it works, so it always feels like one agent. */
export default function AgentSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="pf-tape">
      <div aria-hidden className="pf-tape-slot" />
      <div className="pf-tape-shadow">
        <ol className="pf-receipt flex flex-col gap-1 px-4 pb-5 pt-3 text-[13px] uppercase leading-snug" aria-live="polite">
          <AnimatePresence initial={false}>
            {steps.map((step) => (
              <motion.li
                key={step.id}
                className="flex items-baseline gap-1.5 overflow-hidden"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
              >
                <span className="min-w-0 truncate">{step.label}</span>
                <span aria-hidden className="pf-tape-leader" />
                {step.status === 'complete'
                  ? <span className="max-w-[55%] shrink-0 truncate">{step.detail || 'OK'}</span>
                  : <span aria-hidden className="pf-tape-cursor" />}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </div>
  );
}
