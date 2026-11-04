'use client';

import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface TickingProps {
  value: number;
  /** Must be stable between renders. */
  format: (value: number) => string;
  className?: string;
}

/** A number that rolls to its new value instead of jumping. */
export function Ticking({ value, format, className }: TickingProps) {
  const element = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const controls = animate(shown.current, value, {
      duration: 0.55,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (current) => {
        shown.current = current;
        if (element.current) element.current.textContent = format(current);
      },
    });
    return () => controls.stop();
  }, [value, format]);

  return <span ref={element} className={className}>{format(value)}</span>;
}
