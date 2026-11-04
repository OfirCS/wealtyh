"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SuggestionChip } from "@/lib/types";
import { playSound } from "@/lib/sounds";

interface PromptInputProps {
  onSubmit: (event: string) => void;
  chips: SuggestionChip[];
  placeholder?: string;
  autoFocus?: boolean;
}

const MIN_LENGTH = 3;
const MAX_HEIGHT = 120;

export default function PromptInput({ onSubmit, chips, placeholder, autoFocus }: PromptInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isValid = text.trim().length >= MIN_LENGTH;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "32px";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const submit = useCallback((value: string) => {
    if (value.trim().length < MIN_LENGTH) return;
    playSound("next");
    onSubmit(value.trim());
  }, [onSubmit]);

  return (
    <div>
      <div className="flex items-end gap-3 border-b-2 border-[var(--pf-border)] pb-3 transition-colors focus-within:border-[var(--pf-text-primary)]">
        <label className="sr-only" htmlFor="pf-prompt">What&rsquo;s changing in your life?</label>
        <textarea
          id="pf-prompt"
          ref={textareaRef}
          rows={1}
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(text);
            }
          }}
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent text-[20px] leading-[32px] text-[var(--pf-text-primary)] outline-none placeholder:text-[var(--pf-text-tertiary)]"
        />
        <button
          type="button"
          onClick={() => submit(text)}
          disabled={!isValid}
          aria-label="Make my plan"
          className="pf-btn pf-btn-primary h-10 w-10 shrink-0 p-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 [&>*:nth-child(n+4)]:hidden sm:[&>*:nth-child(n+4)]:inline-flex">
        {chips.map((chip) => (
          <button key={chip.label} type="button" className="pf-pill" onClick={() => submit(chip.prompt)}>
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
