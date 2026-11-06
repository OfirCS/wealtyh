'use client';

import { useRef, useState } from 'react';
import { playSound } from '@/lib/sounds';
import Sheet from '@/components/ui/Sheet';

interface FilePanelProps {
  onClose: () => void;
  onFiles: (files: File[]) => void;
}

/** For anything no connection can see: statements, and photos of paper receipts. */
export function FilePanel({ onClose, onFiles }: FilePanelProps) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = (files: File[]) => {
    if (files.length === 0) return;
    onClose();
    onFiles(files);
  };

  return (
    <Sheet title="Add" onClose={onClose}>
      <button
        type="button"
        onClick={() => { input.current?.click(); playSound('tap'); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(false);
          send([...event.dataTransfer.files]);
        }}
        className={`flex h-[clamp(96px,20vh,150px)] w-full cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed transition-colors ${dragging ? 'border-[var(--pf-text-primary)] bg-[var(--pf-bg-elevated)]' : 'border-[var(--pf-bg-dark)] hover:border-[var(--pf-text-primary)]'}`}
      >
        <span className="text-[18px] font-medium">Statement, screenshot or receipt</span>
        <span className="mt-0.5 text-[15px] text-[var(--pf-text-secondary)]">Drop it here, or tap</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,.txt,.pdf,image/*"
        multiple
        className="sr-only"
        aria-label="Choose a file"
        onChange={(event) => {
          send([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
      <p className="mt-3 text-[15px] text-[var(--pf-text-tertiary)]">CSV files are read on this device, and only store names I don&rsquo;t recognize go to the AI to be sorted. PDFs are read by Claude.</p>
    </Sheet>
  );
}
