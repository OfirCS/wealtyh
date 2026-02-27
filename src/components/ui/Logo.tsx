import React from 'react';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/10 bg-[#233026]">
        <svg
          width="32"
          height="32"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0"
        >
          {/* We use the nano-banana dark green background #233026 directly on the div */}

          {/* Group 1: The Money Path */}
          <g transform="translate(256, 320) scale(0.9)">
            {/* Bill 1 (Bottom Left) */}
            <g transform="translate(-100, 80) rotate(-15)">
              <rect x="-60" y="-35" width="120" height="70" rx="8" fill="#D8AF39" stroke="#1A241C" strokeWidth="12" />
              <rect x="-60" y="-35" width="120" height="70" rx="8" fill="none" stroke="#C49B2F" strokeWidth="4" />
              <circle cx="0" cy="0" r="16" fill="#1A241C" opacity="0.8" />
            </g>

            {/* Bill 2 (Middle) */}
            <g transform="translate(0, 0) rotate(5)">
              <rect x="-60" y="-35" width="120" height="70" rx="8" fill="#C49B2F" stroke="#1A241C" strokeWidth="12" />
              <rect x="-60" y="-35" width="120" height="70" rx="8" fill="none" stroke="#D8AF39" strokeWidth="4" />
              <circle cx="0" cy="0" r="16" fill="#1A241C" opacity="0.8" />
            </g>

            {/* Bill 3 (Top Right Background) */}
            <g transform="translate(100, -80) rotate(20)">
              <rect x="-60" y="-35" width="120" height="70" rx="8" fill="#D8AF39" stroke="#1A241C" strokeWidth="12" />
              <rect x="-60" y="-35" width="120" height="70" rx="8" fill="none" stroke="#C49B2F" strokeWidth="4" />
              <circle cx="0" cy="0" r="16" fill="#1A241C" opacity="0.8" />
            </g>
          </g>

          {/* Group 2: The Nano Banana (Riding the path) */}
          <g transform="translate(256, 180) scale(1.1) rotate(-15)">
            {/* Outline/Stroke layer for contrast against the bills */}
            <path d="M-80,-60 Q-120,0 -80,60 Q-40,80 20,80 Q80,80 110,30 Q120,10 100,-20 Q80,-50 20,-50 Q-40,-50 -80,-60" fill="#233026" stroke="#1A241C" strokeWidth="18" />

            {/* Main body of banana */}
            <path d="M-80,-60 Q-120,0 -80,60 Q-40,80 20,80 Q80,80 110,30 Q120,10 100,-20 Q80,-50 20,-50 Q-40,-50 -80,-60" fill="#FDE047" />

            {/* Highlight/Shadow for depth */}
            <path d="M-80,-60 Q-120,0 -80,60 Q-40,80 0,80 Q-40,60 -70,0 Q-40,-40 -80,-60" fill="#EAB308" opacity="0.6" />

            {/* Stem outline */}
            <rect x="-95" y="-75" width="20" height="25" rx="4" fill="none" stroke="#1A241C" strokeWidth="16" transform="rotate(-10)" />
            {/* Stem */}
            <rect x="-95" y="-75" width="20" height="25" rx="4" fill="#1A241C" transform="rotate(-10)" />
          </g>
        </svg>
      </div>

      <span
        className="font-serif text-[22px] font-medium tracking-tight"
        style={{
          color: 'var(--ws-text-primary)',
          transition: 'color 500ms ease-in-out',
        }}
      >
        wealtyh
      </span>
    </div>
  );
}
