'use client';

import { useSyncExternalStore } from 'react';
import { isSoundEnabled, subscribeToSound, toggleSound } from '@/lib/sounds';

export default function SoundToggle() {
  const on = useSyncExternalStore(subscribeToSound, isSoundEnabled, () => true);

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      title={on ? 'Sound on' : 'Sound off'}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--pf-text-primary)] transition-colors hover:bg-[var(--pf-bg-hover)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.500v5h3.500L12.500 19V5L7.500 9.500H4Z" />
        {on ? (
          <>
            <path d="M16 9.200a4 4 0 0 1 0 5.600" />
            <path d="M18.600 6.600a7.800 7.800 0 0 1 0 10.800" />
          </>
        ) : (
          <path d="m16.500 9.500 5 5m0-5-5 5" />
        )}
      </svg>
    </button>
  );
}
