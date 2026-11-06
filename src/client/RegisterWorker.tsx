'use client';

import { useEffect } from 'react';

/** Lets the app open with no signal, once it's been added to a phone's Home Screen. */
export default function RegisterWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}
