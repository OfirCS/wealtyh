'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { api } from '@/client/api';
import { playSound } from '@/lib/sounds';
import AgentLight from '@/components/ui/AgentLight';
import Sheet from '@/components/ui/Sheet';

/** A shared shortcut, once there is one. Until then the steps build it by hand. */
const SHORTCUT = process.env.NEXT_PUBLIC_WALLET_SHORTCUT;

const SHORTCUT_STEPS = ['Add the shortcut on your iPhone', 'Paste your link when it asks', 'Tap with Apple Pay once to test it'];

const HAND_STEPS = [
  'On your iPhone: Shortcuts → Library → Automation → +',
  'Edit → Automation → Wallet, then pick your cards',
  'Add Get Contents of URL and paste your link',
  'Show More: Method POST, Request Body JSON',
  'Add two Text fields: amount = Amount, merchant = Merchant',
  'Tap ▶ and choose Allow. It should say Connected',
];

interface ApplePanelProps {
  /** A demo has no account for taps to land in. */
  canConnect: boolean;
  connected: boolean;
  /** How it's going, in a few words. */
  status: string;
  onLinked: () => void;
  onClose: () => void;
}

/** Each Apple Pay tap reaches the budget by itself. Apple has no other door for a website. */
export default function ApplePanel({ canConnect, connected, status, onLinked, onClose }: ApplePanelProps) {
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const copyLink = async () => {
    setProblem(null);
    try {
      // The server only keeps a hash, so a link can be shown once and a new one replaces it
      const { link } = await api.walletToken();
      await navigator.clipboard.writeText(link);
      setCopied(true);
      playSound('pop');
      onLinked();
    } catch {
      setProblem("I couldn't make your link. Try again.");
    }
  };

  const steps = SHORTCUT ? SHORTCUT_STEPS : HAND_STEPS;

  return (
    <Sheet title="Apple Wallet" onClose={onClose}>
      <p className="flex items-center gap-2 text-[15px] text-[var(--pf-text-secondary)]"><AgentLight />{status}</p>

      {canConnect ? (
        <>
          <button type="button" onClick={() => void copyLink()} className="pf-btn pf-btn-agent mt-3 h-11 w-full">
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? 'Copied. Now open your iPhone' : connected ? 'Copy a new link' : 'Copy my link'}
          </button>
          {connected && !copied && <p className="mt-1.5 text-[13px] text-[var(--pf-text-tertiary)]">A new link replaces the one on your phone.</p>}
          {problem && <p className="mt-1.5 text-[15px] text-[var(--pf-warn)]" role="alert">{problem}</p>}

          <ol className="mt-4 flex flex-col gap-2 text-[15px]">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pf-bg-elevated)] text-[13px] font-bold">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          {SHORTCUT && <a href={SHORTCUT} className="pf-btn pf-btn-primary mt-4 h-11 w-full">Add the shortcut</a>}
        </>
      ) : (
        <p className="mt-3 text-[15px]">Sign in with Google to connect your iPhone.</p>
      )}
    </Sheet>
  );
}
