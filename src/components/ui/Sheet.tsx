'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** A panel over the page, so secondary detail never makes the page itself scroll. */
export default function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
      <div className="absolute inset-0 bg-[#1C1B18]/30" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-[640px] flex-col rounded-t-[22px] bg-[var(--pf-bg-surface)] p-6 sm:rounded-[24px]"
        initial={{ y: 28 }}
        animate={{ y: 0 }}
        exit={{ y: 20 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      >
        <div className="mb-4 flex shrink-0 items-baseline justify-between gap-4">
          <h2 className="font-serif text-[28px] leading-tight">{title}</h2>
          <button type="button" className="pf-link" onClick={onClose} autoFocus>Close</button>
        </div>
        <div className="hide-scrollbar min-h-0 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
}
