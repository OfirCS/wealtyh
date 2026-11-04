'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Budget } from '@/lib/budget';
import { useBudgetImport } from '@/lib/use-budget-import';
import AgentSteps from '@/components/ui/AgentSteps';
import Sheet from '@/components/ui/Sheet';
import ConnectList from '@/components/budget/ConnectList';

interface ConnectStepProps {
  event: string;
  onConnected: (budget: Budget) => void;
  onTypeInstead: () => void;
  onBack: () => void;
}

/** Comes before any typing: connect once and the agent works out the numbers. */
export default function ConnectStep({ event, onConnected, onTypeInstead, onBack }: ConnectStepProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState('');
  const onImported = useCallback((budget: Budget) => onConnected(budget), [onConnected]);
  const { steps, error, addFile, addText } = useBudgetImport({ budget: null, fallbackIncome: 0, onImported });

  return (
    <div
      className="mx-auto flex h-full max-w-[640px] flex-col"
      onDragOver={(dragEvent) => dragEvent.preventDefault()}
      onDrop={(dragEvent) => {
        dragEvent.preventDefault();
        const file = dragEvent.dataTransfer.files[0];
        if (file) void addFile(file);
      }}
    >
      <p className="mt-2 truncate text-[14px] text-[var(--pf-text-tertiary)]">Planning for: {event}</p>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {steps ? (
          <>
            <h1 className="pf-title-lg font-serif">On it.</h1>
            <div className="mt-6"><AgentSteps steps={steps} /></div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.5 }}>
            <h1 className="pf-title-lg font-serif">Let me see your money.</h1>
            <p className="mt-2 text-[17px] text-[var(--pf-text-secondary)]">Pick whichever is easiest. No passwords, no bank login. I&rsquo;ll work out the rest.</p>
            <div className="mt-[clamp(14px,3vh,28px)] overflow-hidden rounded-[18px] border border-[var(--pf-border)]">
              <ConnectList budget={null} onFile={(file, source) => void addFile(file, source)} onPaste={() => setShowPaste(true)} />
            </div>
            {error && <p className="mt-3 text-[15px] font-medium" role="alert">{error}</p>}
          </motion.div>
        )}
      </div>
      {!steps && (
        <div className="flex shrink-0 items-center justify-between">
          <button type="button" className="pf-link" onClick={onBack}>Back</button>
          <button type="button" className="pf-link" onClick={onTypeInstead}>Type it in instead</button>
        </div>
      )}

      <AnimatePresence>
        {showPaste && (
          <Sheet title="Paste a receipt or bank alert" onClose={() => setShowPaste(false)}>
            <label htmlFor="pf-connect-paste" className="sr-only">Pasted text</label>
            <textarea
              id="pf-connect-paste"
              autoFocus
              rows={6}
              value={pasted}
              onChange={(changeEvent) => setPasted(changeEvent.target.value)}
              placeholder="Paste a bank alert, order email or receipt"
              className="w-full resize-none rounded-[12px] bg-[var(--pf-bg-elevated)] p-3 text-[15px] outline-none"
            />
            <p className="mt-2 text-[14px] text-[var(--pf-text-tertiary)]">Claude reads it to find the amounts.</p>
            <button
              type="button"
              className="pf-btn pf-btn-primary mt-3 h-11 w-full"
              disabled={pasted.trim().length < 8}
              onClick={() => {
                addText(pasted);
                setShowPaste(false);
              }}
            >
              Read it
            </button>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
