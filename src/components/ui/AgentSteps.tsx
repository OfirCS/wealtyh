'use client';

import { AnimatePresence, motion } from 'framer-motion';

export interface AgentStep {
  id: string;
  label: string;
  status: 'active' | 'complete';
  detail?: string;
}

/** What the agent is doing right now. Used everywhere it works, so it always feels like one agent. */
export default function AgentSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="flex flex-col gap-2.5" aria-live="polite">
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <motion.li
            key={step.id}
            className="flex items-baseline gap-3 text-[17px]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <span aria-hidden className="flex w-4 shrink-0 justify-center">
              {step.status === 'complete' ? (
                <span>✓</span>
              ) : (
                <motion.span
                  className="inline-block h-2 w-2 rounded-full bg-[var(--pf-text-primary)]"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
              )}
            </span>
            <span className={`shrink-0 ${step.status === 'complete' ? 'text-[var(--pf-text-secondary)]' : ''}`}>{step.label}</span>
            {step.detail && <span className="min-w-0 truncate text-[14px] text-[var(--pf-text-tertiary)]">{step.detail}</span>}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
