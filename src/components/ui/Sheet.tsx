'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface SheetProps {
  /** Names the panel. It shows at the top unless there's a heading, or the panel says it hides. */
  title: string;
  /** Takes the title's place, for a panel whose name can be edited. */
  heading?: React.ReactNode;
  hideTitle?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** A panel over the page, so secondary detail never makes the page itself scroll. */
export default function Sheet({ title, heading, hideTitle = false, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const close = (
    <button type="button" aria-label="Close" className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--pf-text-secondary)] transition-colors hover:bg-[var(--pf-bg-hover)]" onClick={onClose} autoFocus><X size={20} /></button>
  );

  // Lives on the page itself, so a panel with a fade or a scroll can't clip it
  return createPortal(
    <motion.div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
      <div className="absolute inset-0 bg-[#1C1B18]/30" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-[480px] flex-col rounded-t-[16px] bg-[var(--pf-bg-surface)] p-5 pb-[calc(20px+var(--pf-badge-room,0px))] shadow-[0_24px_60px_rgba(28,27,27,0.18)] sm:rounded-[16px] sm:p-6"
        initial={{ y: 28 }}
        animate={{ y: 0 }}
        exit={{ y: 20 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      >
        {hideTitle ? (
          <div className="absolute right-7 top-7 z-10 sm:right-8 sm:top-8 [&_button]:text-[var(--pf-ink)] [&_button:hover]:bg-[rgba(28,27,27,0.12)]">{close}</div>
        ) : (
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            {heading ?? <h2 className="pf-title min-w-0">{title}</h2>}
            {close}
          </div>
        )}
        <div className="hide-scrollbar min-h-0 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
