import React from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <h1 className="font-serif text-[26px] font-bold tracking-tight text-[var(--ws-text-primary)]">
        Wealthy
      </h1>
    </div>
  );
}
