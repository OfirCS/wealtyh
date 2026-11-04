'use client';

import { useState } from 'react';
import { playSound } from '@/lib/sounds';
import Sheet from '@/components/ui/Sheet';

const STEPS = [
  'On your iPhone, open Shortcuts and tap Automation.',
  'Tap the plus, then choose Transaction.',
  'Pick your cards, then Run Immediately.',
  'Add Open URLs and paste the link below.',
  'Swap AMOUNT and MERCHANT for the Shortcut values.',
];

/** Apple has no way for a website to read Wallet, so the iPhone sends each tap here. */
export default function ApplePanel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?spent=AMOUNT&at=MERCHANT`;

  return (
    <Sheet title="Log every Apple Pay tap" onClose={onClose}>
      <p className="text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">Set this up once. After that, each tap lands in your sheet by itself.</p>
      <ol className="mt-3 flex flex-col gap-2 text-[16px]">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-3">
            <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pf-bg-elevated)] text-[13px] font-semibold">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-[var(--pf-bg-elevated)] p-3">
        <code className="min-w-0 flex-1 break-all text-[13px]">{link}</code>
        <button
          type="button"
          className="pf-btn pf-btn-secondary h-9 shrink-0 px-4 text-[13px]"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
            playSound('pop');
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-[14px] text-[var(--pf-text-tertiary)]">Works once Pathfinder is online at a real address. Covers in-store Apple Pay.</p>
    </Sheet>
  );
}
