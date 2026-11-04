'use client';

import { useRef, useState } from 'react';
import { playSound } from '@/lib/sounds';
import Sheet from '@/components/ui/Sheet';

interface FilePanelProps {
  onClose: () => void;
  onFile: (file: File) => void;
}

/** The manual fallback, for banks that don\u2019t send email alerts. */
export function FilePanel({ onClose, onFile }: FilePanelProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = (file: File) => {
    onClose();
    onFile(file);
  };

  return (
    <Sheet title="Add a bank statement" onClose={onClose}>
      <p className="text-[16px] leading-relaxed text-[var(--pf-text-secondary)]">Sign in to your bank, find your transactions, and download them as a CSV or PDF.</p>
      <button
        type="button"
        onClick={() => { input.current?.click(); playSound('tap'); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) send(file);
        }}
        className={`mt-4 flex h-[clamp(96px,20vh,150px)] w-full cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed transition-colors ${dragging ? 'border-[var(--pf-text-primary)] bg-[var(--pf-bg-elevated)]' : 'border-[var(--pf-bg-dark)] hover:border-[var(--pf-text-primary)]'}`}
      >
        <span className="text-[17px] font-medium">Drop your statement here</span>
        <span className="mt-0.5 text-[14px] text-[var(--pf-text-secondary)]">or click to choose a file</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,.txt,.pdf"
        className="sr-only"
        aria-label="Choose a file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) send(file);
          event.target.value = '';
        }}
      />
      <p className="mt-3 text-[14px] text-[var(--pf-text-tertiary)]">CSV files stay on this device. PDFs are read by Claude.</p>
    </Sheet>
  );
}
