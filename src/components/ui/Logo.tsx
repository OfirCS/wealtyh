import React from 'react';

interface LogoProps {
  className?: string;
}

/** A "P" drawn as a map pin: the bowl is the pin's head, the stem is the way there. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 12.5C6 6.15 11.15 1 17.500 1S29 6.15 29 12.5 23.850 24 17.500 24c-2.140 0-4.150-.59-5.870-1.610-.3-.18-.63.04-.63.39V29a2.500 2.500 0 0 1-5 0V12.500Zm11.500 4.500a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 text-[var(--pf-text-primary)] ${className}`}>
      <LogoMark />
      <span className="font-serif text-[23px] leading-none" style={{ fontWeight: 500 }}>Pathfinder</span>
    </div>
  );
}
