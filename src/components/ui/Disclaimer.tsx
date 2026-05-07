'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'pathfinder.disclaimer-ack.v1';

function readAcknowledged(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export default function Disclaimer() {
  const acknowledged = useSyncExternalStore(
    subscribe,
    readAcknowledged,
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  const visible = !acknowledged && !dismissed;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md"
        >
          <div
            className="rounded-2xl border shadow-xl px-4 py-3 flex items-start gap-3"
            style={{
              backgroundColor: 'var(--ws-bg-primary)',
              borderColor: 'var(--ws-border)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: 'var(--ws-bg-surface)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold mb-0.5"
                style={{ color: 'var(--ws-text-primary)' }}
              >
                For learning, not advice
              </p>
              <p
                className="text-[12px] leading-snug"
                style={{ color: 'var(--ws-text-secondary)' }}
              >
                Numbers are estimates. Check with a real advisor before any big move.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-full shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--ws-text-primary)',
                color: 'var(--ws-bg-primary)',
              }}
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
