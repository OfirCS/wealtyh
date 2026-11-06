'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { playSound } from '@/lib/sounds';

/** The one door while the site is private. */
export default function UnlockPage() {
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const unlock = async () => {
    setWaiting(true);
    setProblem(null);
    const response = await fetch('/api/v1/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (response?.ok) {
      playSound('complete');
      window.location.assign('/');
      return;
    }
    const data = await response?.json().catch(() => null) as { error?: { message?: string } } | null;
    setProblem(data?.error?.message ?? 'Something went wrong. Try again.');
    setWaiting(false);
  };

  return (
    <main className="pf-paper flex h-[100dvh] items-center justify-center px-5">
      <form className="w-full max-w-[340px]" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
        <div className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <span className="font-serif text-[22px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
        </div>
        <h1 className="mt-6 font-serif text-[40px] leading-none tracking-tight">Private for now.</h1>
        <label className="mt-5 flex h-12 items-center gap-2 rounded-[12px] bg-[var(--pf-bg-surface)] pl-3.5 pr-2 shadow-[inset_0_0_0_1px_var(--pf-border)] focus-within:shadow-[inset_0_0_0_1px_var(--pf-text-primary)]">
          <span className="sr-only">Password</span>
          <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--pf-text-tertiary)]" />
          <button type="submit" aria-label="Unlock" disabled={!password || waiting} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] bg-[var(--pf-ink)] text-[var(--pf-ivory)] disabled:cursor-default disabled:opacity-25"><ArrowRight size={16} /></button>
        </label>
        {problem && <p className="mt-2 text-[14px] text-[var(--pf-warn)]" role="alert">{problem}</p>}
      </form>
    </main>
  );
}
