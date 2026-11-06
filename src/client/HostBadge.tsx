'use client';

import { useEffect } from 'react';

const BADGE = '#nl-badge-frame, #nl-hud-frame';

/**
 * Netlify's free plan pins a badge over the bottom corner, above everything. It has to stay, so
 * this marks the page and the phone tabs and buttons sit above it. No badge, no extra room.
 */
export default function HostBadge() {
  useEffect(() => {
    const check = (): boolean => {
      const found = document.querySelector(BADGE) !== null;
      document.documentElement.classList.toggle('pf-host-badge', found);
      return found;
    };
    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
