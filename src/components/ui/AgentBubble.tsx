'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LogoMark } from './Logo';

interface AgentBubbleProps {
  message: string;
  tone?: 'normal' | 'good' | 'problem';
}

/** The agent's voice. Everything it says, including problems, appears here in plain words. */
export default function AgentBubble({ message, tone = 'normal' }: AgentBubbleProps) {
  const background = tone === 'problem' ? 'var(--pf-warn-soft)' : tone === 'good' ? 'var(--pf-good-soft)' : 'var(--pf-bg-elevated)';

  return (
    <div className="flex min-w-0 items-center gap-2.5" role="status" aria-live="polite">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pf-text-primary)] text-[var(--pf-text-inverse)]">
        <LogoMark size={16} />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="min-w-0 rounded-[14px] rounded-bl-[4px] px-3.5 py-2 text-[15px] leading-snug text-[var(--pf-text-primary)]"
          style={{ background }}
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
