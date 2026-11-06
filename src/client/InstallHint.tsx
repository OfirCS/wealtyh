'use client';

import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';

const DISMISSED = 'pathfinder.install-hint.v1';

const noChange = () => () => undefined;

/** An iPhone can only add a site to its Home Screen by hand, and most people don't know that. */
function shouldHint(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return /iPhone/.test(navigator.userAgent) && !standalone && !window.localStorage.getItem(DISMISSED);
}

export default function InstallHint() {
  const wanted = useSyncExternalStore(noChange, shouldHint, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!wanted || dismissed) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-[var(--pf-border)] bg-[var(--pf-bg-surface)] py-2 pl-4 pr-2 text-[13.5px] lg:hidden">
      <p className="min-w-0 flex-1 leading-snug">Keep it on your Home Screen: tap Share, then Add to Home Screen.</p>
      <button
        type="button"
        aria-label="Dismiss"
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-[var(--pf-text-tertiary)]"
        onClick={() => {
          window.localStorage.setItem(DISMISSED, '1');
          setDismissed(true);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
