import React from 'react';

function MoneyPathMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M9 50C16 44 24 40 30 33C36 27 42 20 55 13"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      <g transform="rotate(-18 17 45)">
        <rect x="7" y="39" width="20" height="12" rx="2.6" stroke="currentColor" strokeWidth="2.5" />
        <rect x="10.5" y="42.4" width="13" height="5.2" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="17" cy="45" r="1.8" fill="currentColor" />
      </g>

      <g transform="rotate(6 31 30)">
        <rect x="21" y="24" width="20" height="12" rx="2.6" stroke="currentColor" strokeWidth="2.5" />
        <rect x="24.5" y="27.4" width="13" height="5.2" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="31" cy="30" r="1.8" fill="currentColor" />
      </g>

      <g transform="rotate(24 47 16)">
        <rect x="37" y="10" width="20" height="12" rx="2.6" stroke="currentColor" strokeWidth="2.5" />
        <rect x="40.5" y="13.4" width="13" height="5.2" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="47" cy="16" r="1.8" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex items-center justify-center w-8 h-8 rounded-[10px] shadow-sm overflow-hidden bg-[var(--ws-text-primary)] text-[var(--ws-bg-surface)]">
        <MoneyPathMark className="w-8 h-8" />
      </div>

      <span
        className="font-serif text-[22px] font-medium tracking-tight"
        style={{
          color: 'var(--ws-text-primary)',
          transition: 'color 500ms ease-in-out',
        }}
      >
        wealtyh.tech
      </span>
    </div>
  );
}
